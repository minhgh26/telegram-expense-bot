#!/usr/bin/env python3
"""Rebuild commits exported by exporting-commits-to-notion onto the current
branch. For each page, in order, it applies the commit's per-file diffs with
`git apply`, places any supplied copies of files the page couldn't carry (or
deletes a removed file too large to have shipped as a diff), stages everything,
and commits with the page's recorded author and date.

This does not try to give the rebuilt commit the same id it had on the
exporting branch — it only needs the working tree, after each commit, to match
what that commit produced there. It stops at the first commit whose diff
doesn't apply (the branch has diverged from what the export assumed) or whose
"Not included" list names a file --supply doesn't have.

Usage:
  python import_commits.py <page-file>... [--supply DIR] [--repo DIR]
"""
import argparse, pathlib, re, subprocess, sys, tempfile

# The repo tracks this skill's __pycache__: writing bytecode would dirty the
# tree, and the next run would refuse to start.
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "exporting-commits-to-notion"))
try:
    from export_commits import (build, fetched_content, first_diff, git, gtext, norm, parse_meta,
                                parse_page, parse_skips, subject_of)
except ImportError:
    sys.exit("export_commits.py not found: the exporting-commits-to-notion skill must sit next to "
             "this one, since it owns the page format")


def load(path):
    text = fetched_content(path)
    author, date = parse_meta(text)
    if author is None:
        sys.exit(f"{path}: no Author/Date line. Is this a commit page?")
    message, _, files, _ = parse_page(text)
    if message is None:
        sys.exit(f"{path}: no commit message block. Is it a commit page?")
    message = message.replace("\r\n", "\n").rstrip("\n")
    diffs = {}
    for p, bodies in files.items():
        if len(bodies) != 1 or bodies[0] is None:
            sys.exit(f"{path}: `{p}` has {len(bodies)} code blocks, expected 1")
        diffs[p] = bodies[0]
    return {"subject": subject_of(message), "author": author, "date": date,
            "message": message, "diffs": diffs, "skips": parse_skips(text)}


def apply_patch(repo, diffs):
    """None, or why `git apply` refused the commit's combined diff."""
    if not diffs:
        return None
    patch = "\n".join(diffs.values()) + "\n"
    r = subprocess.run(["git", "apply", "--whitespace=nowarn", "-"], cwd=repo,
                        input=patch.encode("utf-8"), capture_output=True)
    return r.stderr.decode("utf-8", "replace").strip() if r.returncode != 0 else None


MODE_RE = re.compile(r"(?m)^new (?:file )?mode (\d{6})$")


def restore_modes(repo, diffs):
    """Set each staged file's exec bit from its page's mode line: on a filesystem
    without one (Windows), `git apply` and `git add` both record 100644."""
    for path, body in diffs.items():
        m = MODE_RE.search(body)
        if m and m.group(1) in ("100644", "100755"):
            git(repo, "update-index", f"--chmod={'+x' if m.group(1) == '100755' else '-x'}", "--", path)


def mismatches(repo, page):
    """[problem] where the commit just made disagrees with its page."""
    ns = argparse.Namespace(exclude=[], include_env=True, max_file_chars=sys.maxsize)
    message, texts, *_ = build(repo, "HEAD", ns)
    bad = []
    if norm(message) != norm(page["message"]):
        bad.append("commit message" + first_diff(page["message"], message))
    for path, want in page["diffs"].items():
        if path not in texts:
            bad.append(f"{path}: on the page, not in the commit")
        elif norm(want) != norm(texts[path]):
            bad.append(path + first_diff(want, texts[path]))
    return bad


def commit(repo, page):
    """None, or why `git commit` failed (a hook, usually)."""
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(page["message"] + "\n")
        msgfile = f.name
    try:
        r = subprocess.run(["git", "commit", "--author", page["author"], "--date", page["date"],
                            "-F", msgfile, "-q"], cwd=repo, capture_output=True)
    finally:
        pathlib.Path(msgfile).unlink(missing_ok=True)
    if r.returncode == 0:
        return None
    return (r.stdout + r.stderr).decode("utf-8", "replace").strip()


def resolve_skips(repo, skips, supply):
    """Apply --supply copies / deletions for a commit's Not-included list. -> [problem]."""
    problems = []
    for path, reason, action in skips:
        target = repo / path
        if action.startswith("delete"):
            target.unlink(missing_ok=True)
            continue
        src = (supply / path) if supply else None
        if not src or not src.is_file():
            where = f"{supply / path}" if supply else f"{path} (pass --supply DIR)"
            problems.append(f"{path}: {reason} — not on the page; supply a copy at {where}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(src.read_bytes())
    return problems


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pages", nargs="+", help="fetched commit pages, in the main page's order")
    ap.add_argument("--supply", type=pathlib.Path,
                    help="directory holding copies of files the pages don't carry, at their repo paths")
    ap.add_argument("--repo", default=".")
    args = ap.parse_args()
    repo = pathlib.Path(args.repo).resolve()
    supply = args.supply.resolve() if args.supply else None

    if gtext(repo, "status", "--porcelain").strip():
        sys.exit("working tree has uncommitted changes: commit or stash them first")

    pages = [load(p) for p in args.pages]
    built, clean = 0, True
    for k, page in enumerate(pages, 1):
        label = f"{k:02d} {page['subject']}"
        problem = apply_patch(repo, page["diffs"])
        if problem:
            print(f"{label}: STOPPED\n    patch did not apply:\n" +
                  "\n".join(f"    {line}" for line in problem.splitlines()))
            break
        problems = resolve_skips(repo, page["skips"], supply)
        if problems:
            print(f"{label}: STOPPED")
            for p in problems:
                print(f"    {p}")
            break
        git(repo, "add", "-A")
        restore_modes(repo, page["diffs"])
        problem = commit(repo, page)
        if problem:
            # The tree was clean before this page, so everything uncommitted is this
            # page's: drop it, and a rerun can start from this page.
            git(repo, "reset", "--hard", "-q", "HEAD")
            git(repo, "clean", "-fdq")
            print(f"{label}: STOPPED\n    git commit failed, its changes were undone:\n" +
                  "\n".join(f"    {line}" for line in problem.splitlines()[-15:]))
            break
        print(f"{label} -> {gtext(repo, 'rev-parse', '--short', 'HEAD').strip()}")
        built += 1
        bad = mismatches(repo, page)
        if bad:
            clean = False
            print(f"{label}: STOPPED\n    committed, but it differs from the page:")
            for b in bad:
                print(f"    {b}")
            break

    branch = git(repo, "symbolic-ref", "--short", "-q", "HEAD", ok_fail=True)
    branch = branch.decode().strip() if branch else "HEAD"
    if built:
        print(f"{branch} is now at {gtext(repo, 'rev-parse', '--short', 'HEAD').strip()}: "
              f"{built} commit(s) added")
    if built < len(pages) or not clean:
        sys.exit(1)


if __name__ == "__main__":
    main()
