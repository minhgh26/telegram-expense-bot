#!/usr/bin/env python3
"""Render git commits as Notion child pages, one page per commit, and verify
what Notion stored against git.

Each page carries the commit's author/date, its raw message in a code block,
then every file the commit touched as a unified diff against its first parent
(the empty tree for a root commit), in the file-per-block layout `import-notion-
commits` parses:

    ### `path/to/file.ext`
    ```diff
    ...unified diff for that path...
    ```

`import-notion-commits` applies each commit's diffs with `git apply` and makes
an ordinary commit with the recorded author and date. It does not try to
reproduce the exporting branch's commit ids — only the resulting code. A
binary file, a non-UTF-8 file, a submodule pointer, or a diff over the size
cap can't be shipped as a diff; those paths are listed under "Not included"
with an instruction (supply a copy at import time, or delete the file, for a
removed path too large to diff), and the importer stops there if it's not
given what it needs.

Notion's markdown parser knows only the three-backtick fence. It ignores ~~~,
reads ```` as ```, and closes a code block on the first line that starts with
```, even behind a zero-width space. So a content line that starts with ```,
or that looks like a ### `path` header (import-notion splits on those), gets a
backslash in front. Notion stores code-block content literally, and verify and
import-notion remove that one backslash on the way back. A line that already
starts with backslashes before ``` gets one more, so the escape is exactly
reversible.

render  writes <out-dir>/manifest.json plus <NN>-<sha7>-<part>.md files per
        commit, oldest first, and fails if any page would not parse back to
        its files.
verify  compares a fetched Notion page with git and exits non-zero on any drift.

Usage:
  python export_commits.py render <out-dir> <rev>... [--repo DIR] [--exclude SUBSTR]...
                                  [--include-env] [--max-file-chars N]
  python export_commits.py verify <out-dir> <n> <fetched-page-file>
"""
import argparse, json, pathlib, re, subprocess, sys

ENV_RE = re.compile(r"(^|/)\.env(\.|$)")
# Templates are committed to be shared and hold no secrets.
ENV_TEMPLATE_RE = re.compile(r"\.env\.(example|sample|template)$")
HEADER_RE = re.compile(r"^### `([^`]+)`\s*$")
# Bash truncates output past 30,000 characters, so a part this size prints whole.
PART_CHARS = 25_000
ESCAPE_RE = re.compile(r"^([ \t]*)(\\*(?:```|### `))", re.M)
UNESCAPE_RE = re.compile(r"^([ \t]*)\\(\\*(?:```|### `))", re.M)
# Pages pasted in through Notion's UI come back with bare URLs as <https://...>
# (import-notion undoes this). Unwrapping both sides makes either form compare equal.
AUTOLINK_RE = re.compile(r"<(https?://[^>\s]*)>")
# git's canonical empty-tree object: diffing against it shows a root commit's
# files as pure additions, the same way it would show against any real parent.
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
SECTION_RE = re.compile(rb"(?m)^diff --git a/(.*) b/(.*)$")
INDEX_LINE_RE = re.compile(rb"(?m)^index [0-9a-fA-F]+\.\.[0-9a-fA-F]+(?: [0-7]{6})?\n")
BINARY_RE = re.compile(rb"(?m)^Binary files .* differ$")
SUBMODULE_RE = re.compile(rb"(?m)^[+-]Subproject commit ")
META_RE = re.compile(r"^Author: `([^`]*)` · Date: `([^`]*)`")
SKIP_RE = re.compile(r"^- `([^`]+)` \(([^)]*)\)(?: — (.+))?$", re.M)


def git(repo, *args, ok_fail=False, input=None, env=None):
    r = subprocess.run(["git", *args], cwd=repo, capture_output=True, input=input, env=env)
    if r.returncode != 0:
        if ok_fail:
            return None
        sys.exit(f"git {' '.join(args)} failed: {r.stderr.decode('utf-8', 'replace').strip()}")
    return r.stdout


def gtext(repo, *args, **kw):
    return git(repo, *args, **kw).decode("utf-8")


def resolve(repo, revs):
    """Expand ranges, then order oldest-first by topology. Committer-date order
    is wrong for rebased commits, which carry a newer date than their children."""
    want = []
    for rev in revs:
        if ".." in rev or rev.startswith("^"):
            want += gtext(repo, "rev-list", rev).split()
        else:
            want.append(gtext(repo, "rev-parse", "--verify", f"{rev}^{{commit}}").strip())
    want = set(want)
    if not want:
        sys.exit("no commits matched")
    order = gtext(repo, "rev-list", "--topo-order", "--reverse", *want).split()
    return [sha for sha in order if sha in want]


def diff_sections(raw):
    """[(path, diff bytes)] for each file in a multi-file unified diff, in
    order. path is the new path, or the old path for a deletion."""
    matches = list(SECTION_RE.finditer(raw))
    out = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        chunk = INDEX_LINE_RE.sub(b"", raw[m.start():end].rstrip(b"\n"))
        a_path = m.group(1).decode("utf-8", "replace")
        b_path = m.group(2).decode("utf-8", "replace")
        out.append((a_path if b_path == "/dev/null" else b_path, chunk))
    return out


def escape(text):
    return ESCAPE_RE.sub(r"\1\\\2", text)


def unescape(text):
    return UNESCAPE_RE.sub(r"\1\2", text)


def norm(text):
    return AUTOLINK_RE.sub(r"\1", text.replace("\r\n", "\n")).rstrip("\n")


def head_lines(content):
    lines = content.split("\n")
    heads = [i for i, line in enumerate(lines) if HEADER_RE.match(line)]
    return lines[:heads[0]] if heads else lines


def parse_meta(text):
    """(author, date) from a page's first line, or (None, None)."""
    m = META_RE.match(text)
    return (m.group(1), m.group(2)) if m else (None, None)


def parse_skips(text):
    """[(path, reason, action)] from a page's 'Not included' bullets."""
    return SKIP_RE.findall("\n".join(head_lines(text)))


def skip_note(path, why):
    if why.startswith("deleted; "):
        return f"- `{path}` ({why[len('deleted; '):]}) — delete this file after import"
    return f"- `{path}` ({why}) — supply this file to include it"


def parse_page(content):
    """Mirror import-notion's parser: a file runs from its ### header to the next
    one, and its body is everything between the first and last fence line in
    that span. Before the first header, fence lines pair up into blocks: the
    message, then (for older pages) a replay block. Block bodies come back with
    the render escape undone. -> (message, second block or None, {path: [body]},
    header count)."""
    lines = content.split("\n")
    heads = [i for i, line in enumerate(lines) if HEADER_RE.match(line)]

    def between_fences(chunk):
        fences = [k for k, line in enumerate(chunk) if line.startswith("```")]
        return unescape("\n".join(chunk[fences[0] + 1:fences[-1]])) if len(fences) >= 2 else None

    head = head_lines(content)
    fences = [k for k, line in enumerate(head) if line.startswith("```")]
    blocks = [unescape("\n".join(head[a + 1:b])) for a, b in zip(fences[::2], fences[1::2])]
    files = {}
    for h, start in enumerate(heads):
        end = heads[h + 1] if h + 1 < len(heads) else len(lines)
        files.setdefault(HEADER_RE.match(lines[start]).group(1), []).append(
            between_fences(lines[start + 1:end]))
    return (blocks[0] if blocks else None, blocks[1] if len(blocks) > 1 else None,
            files, len(heads))


def compare(page, want_message, want_files):
    """[problem] where the parsed page disagrees with what git says it should hold."""
    message, _, files, n_heads = page
    bad = []
    if message is None or norm(message) != norm(want_message):
        bad.append("commit message block" + first_diff(message, want_message))
    if n_heads != len(want_files):
        bad.append(f"{n_heads} file headers for {len(want_files)} files")
    for path, want in want_files.items():
        got = files.get(path, [])
        if len(got) != 1:
            bad.append(f"{path}: {len(got)} headers, expected 1")
        elif got[0] is None:
            bad.append(f"{path}: no code block under its header")
        elif norm(got[0]) != norm(want):
            bad.append(f"{path}" + first_diff(got[0], want))
    return bad


def first_diff(got, want):
    if got is None:
        return ": missing"
    g, w = norm(got).split("\n"), norm(want).split("\n")
    for k, (a, b) in enumerate(zip(g, w)):
        if a != b:
            return f": line {k + 1} is {a!r}, git has {b!r}"
    return f": {len(g)} lines, git has {len(w)}"


def build(repo, sha, args):
    """(message, {path: diff text}, [(path, why skipped)], is_merge, author,
    date, subject) for one commit, applying the same exclude/env/size rules
    render and verify both need."""
    parents = gtext(repo, "rev-list", "--parents", "-n1", sha).split()[1:]
    is_merge = len(parents) > 1
    subject = gtext(repo, "log", "-1", "--format=%s", sha).strip()
    author = gtext(repo, "log", "-1", "--format=%an <%ae>", sha).strip().replace("`", "'")
    date = gtext(repo, "log", "-1", "--format=%ad", "--date=iso", sha).strip()
    message = gtext(repo, "log", "-1", "--format=%B", sha).replace("\r\n", "\n").rstrip("\n")
    base = parents[0] if parents else EMPTY_TREE
    raw = git(repo, "-c", "core.quotePath=false", "diff", "--no-color", "-M", "-U3", base, sha)

    texts, skipped = {}, []
    for path, chunk in diff_sections(raw):
        if any(pat in path for pat in args.exclude):
            skipped.append((path, "excluded")); continue
        if ENV_RE.search(path) and not ENV_TEMPLATE_RE.search(path) and not args.include_env:
            skipped.append((path, "env file, auto-excluded — pass --include-env to include")); continue
        if SUBMODULE_RE.search(chunk):
            skipped.append((path, "submodule")); continue
        deleted = b"\ndeleted file mode " in chunk
        if BINARY_RE.search(chunk):
            skipped.append((path, "deleted; binary" if deleted else "binary")); continue
        try:
            text = chunk.decode("utf-8")
        except UnicodeDecodeError:
            skipped.append((path, "deleted; not utf-8" if deleted else "not utf-8")); continue
        if len(text) > args.max_file_chars:
            size = f"{len(text):,} chars, over --max-file-chars {args.max_file_chars:,}"
            skipped.append((path, f"deleted; {size}" if deleted else size)); continue
        texts[path] = text
    return message, texts, skipped, is_merge, author, date, subject


def render(args):
    repo = pathlib.Path(args.repo).resolve()
    out = pathlib.Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    manifest, failed = [], False

    for n, sha in enumerate(resolve(repo, args.revs), 1):
        message, texts, skipped, is_merge, author, date, subject = build(repo, sha, args)
        blocks = [f"### `{p}`\n```diff\n{escape(t)}\n```" for p, t in texts.items()]

        head = f"Author: `{author}` · Date: `{date}`"
        if is_merge:
            head += " · Merge commit: diff is shown against its first parent."
        head = f"{head}\n```plain text\n{escape(message)}\n```"
        if skipped:   # above the first ### header, where import-notion reads nothing
            head += "\n**Not included:**\n" + "\n".join(skip_note(p, why) for p, why in skipped)
        blocks.insert(0, head)

        # Pack whole blocks into parts that each fit one tool call and one
        # uncut `cat`. A code block split across parts would become two blocks.
        parts = [[]]
        for b in blocks:
            if parts[-1] and len("\n".join(parts[-1] + [b])) > PART_CHARS:
                parts.append([])
            parts[-1].append(b)
        paths = []
        for k, part in enumerate(parts, 1):
            p = out / f"{n:02d}-{sha[:7]}-{k}.md"
            p.write_text("\n".join(part) + "\n", encoding="utf-8", newline="\n")
            paths.append(str(p))

        # Parse back what Notion will hold, all parts together, the way
        # import-notion-commits will read it. Nothing is sent unless this passes.
        body = "\n".join("\n".join(part) for part in parts)
        bad = compare(parse_page(body), message, texts)
        print(f"{n:02d}  {subject}\n    {len(texts)} files, {len(skipped)} not included, "
              f"{len(body):,} chars in {len(parts)} part{'s' * (len(parts) > 1)}")
        for p in paths:
            print(f"    {p}")
        for p, why in skipped:
            print(f"    not included: {p} ({why})")
        if is_merge:
            print("    merge commit: diff shown against its first parent")
        if skipped:
            print(f"    needs on import: {', '.join(p for p, _ in skipped)}")
        else:
            print("    complete: every touched file is on the page")
        for b in bad:
            print(f"    WILL NOT ROUND-TRIP: {b}")
        failed |= bool(bad)
        manifest.append({"n": n, "sha": sha, "title": subject, "parts": paths,
                         "chars": len(body), "files": sorted(texts)})

    (out / "manifest.json").write_text(
        json.dumps({"repo": str(repo), "exclude": args.exclude, "include_env": args.include_env,
                    "max_file_chars": args.max_file_chars, "commits": manifest}, indent=2),
        encoding="utf-8")
    total = sum(m["chars"] for m in manifest)
    print(f"\nrendered {len(manifest)} commits, {total:,} chars -> {out / 'manifest.json'}")
    if failed:
        sys.exit("FAILED: a page above would not parse back to its files")


def fetched_content(path):
    """The notion-fetch result as saved to disk, or its page text pasted raw.
    Saved results can nest the page JSON inside an MCP text item; unwrap until
    the page text, then keep only what sits inside <content>."""
    text = pathlib.Path(path).read_text(encoding="utf-8")
    for _ in range(4):
        try:
            obj = json.loads(text)
        except ValueError:
            break
        if isinstance(obj, list):
            text = "".join(i.get("text", "") for i in obj if isinstance(i, dict))
        elif isinstance(obj, dict) and isinstance(obj.get("text"), str):
            text = obj["text"]
        else:
            break
    # Greedy, to the last </content>: a file in the page may contain the tag itself.
    m = re.search(r"<content>\n?([\s\S]*)\n?</content>", text)
    return m.group(1) if m else text


def subject_of(message):
    return message.split("\n", 1)[0]


def verify(args):
    out = pathlib.Path(args.out_dir).resolve()
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    entry = next((m for m in manifest["commits"] if m["n"] == args.n), None)
    if entry is None:
        sys.exit(f"no commit {args.n} in {out / 'manifest.json'}")
    repo = manifest["repo"]
    ns = argparse.Namespace(exclude=manifest["exclude"], include_env=manifest["include_env"],
                            max_file_chars=manifest["max_file_chars"])
    message, texts, skipped, is_merge, author, date, subject = build(repo, entry["sha"], ns)

    bad = compare(parse_page(fetched_content(args.fetched)), message, texts)
    label = f"{entry['n']:02d} {entry['title']}"
    if bad:
        print(f"FAILED {label}")
        for b in bad:
            print(f"  {b}")
        sys.exit(1)
    print(f"OK {label}: message + {len(texts)} file diffs match git")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("render")
    r.add_argument("out_dir")
    r.add_argument("revs", nargs="+", help="commit ids or ranges (A..B), any order")
    r.add_argument("--repo", default=".")
    r.add_argument("--exclude", action="append", default=[], help="path substring to leave out; repeatable")
    r.add_argument("--include-env", action="store_true", help="include .env files (excluded: they hold secrets)")
    r.add_argument("--max-file-chars", type=int, default=PART_CHARS,
                   help=f"leave out larger diffs (default {PART_CHARS:,}: one part, one uncut cat)")
    v = sub.add_parser("verify")
    v.add_argument("out_dir")
    v.add_argument("n", type=int, help="the commit's number from render's listing")
    v.add_argument("fetched", help="file holding the notion-fetch result for that commit's page")
    args = ap.parse_args()
    render(args) if args.cmd == "render" else verify(args)


if __name__ == "__main__":
    main()
