# exporting-commits-to-notion

Exports git commits to Notion. Each commit becomes one child page under a main page you choose. The page holds the commit's author, date and full message, then a unified diff of every file the commit touched. After sending each page, Claude fetches it back and checks it against git, so the content in Notion matches the commit exactly.

## Before you start

- **Notion connector:** Claude Code must have it connected, with access to the main page.
- **Python 3 and git:** both on `PATH`.
- **Where to run:** start Claude Code inside the repo whose commits you're exporting.

## Usage

```
/mrs:exporting-commits-to-notion <notion-main-page-url> <commit>...
```

| Parameter | Required | What it is |
|---|---|---|
| Notion page URL | Yes, first | The main page. Each commit becomes a child page of it. |
| Commits | At least one | Anything git accepts: ids, ranges, branch names. List them in any order; pages are always created oldest first. |

### Ways to name commits

| Form | Example | Exports |
|---|---|---|
| Single id | `d23f448` | That one commit |
| Several ids | `f0f27e9 89da937 d23f448` | Those three |
| Range | `18261a6..d23f448` | Commits after `18261a6`, up to and including `d23f448` |
| Range including the start | `18261a6^..d23f448` | Same, plus `18261a6` itself |
| Branch vs. base | `develop..feat/ui-alignment` | Everything on the branch that isn't on `develop` |
| Relative | `HEAD~3..HEAD` | The last 3 commits |

`A..B` leaves out `A` itself. Write `A^..B` to include it.

### Examples

```
/mrs:exporting-commits-to-notion https://www.notion.so/My-Export-3e485bb0318c81d98fecc7ecda84c21e d23f448
/mrs:exporting-commits-to-notion https://www.notion.so/My-Export-3e485bb0318c81d98fecc7ecda84c21e develop..feat/ui-alignment
```

### Optional extras

There are no flags to type. Say what you want in plain words after the commits:

| Say | Effect |
|---|---|
| "exclude hs_err_pid" | Leaves out every path containing that text |
| "include diffs up to 100,000 chars" | Raises the per-file diff size cap (default 25,000 characters) |
| "include .env files" | Includes `.env*` files, which are left out by default because they usually hold secrets |

## What you get

The main page gets one child page per commit, in commit order, each titled with the commit's first line. Each page looks like this:

````
Author: `Ethan <ghieuming@gmail.com>` · Date: `2026-09-23 10:02:25 +0700`
```plain text
<the full commit message, exactly as committed>
```
**Not included:**                      ← only when something was left out
- `docs/big.html` (96,620 chars, over --max-file-chars 25,000) — supply this file to include it
### `src/backend/src/main/java/.../Foo.java`
```diff
diff --git a/src/backend/src/main/java/.../Foo.java b/src/backend/src/main/java/.../Foo.java
--- a/src/backend/src/main/java/.../Foo.java
+++ b/src/backend/src/main/java/.../Foo.java
@@ -12,3 +12,4 @@
 ...
```
### `README.md`
```diff
...
```
````

- **Commit id:** not shown on the page. Hashes go stale after a rebase or squash, so the page is identified by its subject and date instead.
- **Merge commits:** show their diff against the first parent, and the page says so. `import-notion-commits` can only replay that diff onto a branch that already sits at the first parent — see "Rebuilding the commits in another repo" below.
- **Rewritten files:** if this commit renamed or deleted a file, the diff carries that too (`rename from`/`rename to`, or `deleted file mode`); the importer applies it with the rest.

### Left out, and listed under "Not included"

| File | Why | What the importer needs |
|---|---|---|
| Binary files | A diff can't represent binary content | A copy, via `--supply` |
| Non-UTF-8 files | The page can only hold UTF-8 text | A copy, via `--supply` |
| Submodule pointers | A gitlink isn't a regular file diff | Not handled; update the submodule separately |
| A diff over 25,000 characters | Every character is sent through Claude's output | A copy (added/modified file) via `--supply`, or nothing (a removed file: just delete it) |
| Paths you excluded | You asked | Whatever you intend |

## Lines that start with `\`

Notion ends a code block at any line starting with three backticks, even when that line is part of a file (for example, a Markdown file containing a code example, or a diff of one). So those lines, and lines that look like the `` ### `path` `` file headers, get a `\` in front on the Notion page:

```
\```java
List<String> xs = List.of("a");
\```
```

This is expected. `import-notion-commits` and the verify step remove it.

## What Claude does when you run it

1. **Render.** It builds the pages from git and shows you the list of commits, sizes and anything left out. If the total is over 100,000 characters, it asks before sending.
2. **Check the main page.** If a commit's title already exists there, it asks whether to replace that page or skip the commit.
3. **Send.** It creates one page per commit, oldest first. A page over 25,000 characters is sent in parts: the first part creates the page and the rest are appended.
4. **Verify.** It fetches each page back and compares the message and every file's diff with a freshly computed diff from git. A commit is only done when this passes.
5. **Report.** It lists each page's title and URL, and anything left out.

## Rebuilding the commits in another repo

`/mrs:import-notion-commits <main-page-url>` applies each page's diff onto the current branch and commits normally. It does **not** try to reproduce this branch's commit ids — only the code. See that skill's README.

Because each diff is relative to the commit's own first parent, replaying works cleanly when the pages form one straight-line chain and the importing branch is at the first page's parent when it starts. A merge commit's diff is against its first parent too, so importing it needs the branch to already be at that parent commit — which is only true if the importing repo's own history already contains it (for example, both sides are the same `develop`, and the import is just catching it up).

## Re-importing files only

The mrs repo's `import-notion` skill reads pages back into files, expecting each header's code block to hold a file's full contents — it does not understand a diff. Point it at a page built by *this* skill's predecessor design only if that page still holds full file contents; a diff-based page from this version is for `import-notion-commits`, not `import-notion`.

## Troubleshooting

| You see | Meaning | What to do |
|---|---|---|
| Notion fetch fails on the main page | The connector can't see that page | Share the page with the Notion connection, or check the URL |
| `WILL NOT ROUND-TRIP` in the render listing | A file can't be stored in this layout, for example a path containing a backtick | Leave it out ("exclude …") or send it some other way |
| `FAILED` from verify | Notion stored something different from git | Claude resends once. If the same file fails again, it stops and shows the line that differs. |
| Validation error from Notion | Notion rejected the page content | Rare. Share the error, since it may be a new Notion quirk. |

## Running the script by hand

You can preview what would be sent without Claude or Notion. Run from inside the repo:

```bash
python .claude/skills/mrs/skills/exporting-commits-to-notion/export_commits.py render <out-dir> <commit>... \
    [--exclude <path-substring>] [--max-file-chars N] [--include-env]
```

It writes `<out-dir>/manifest.json` and one Markdown file per page part, `NN-<sha7>-<part>.md`. It exits non-zero if any page wouldn't read back to its files.

To check a page someone fetched from Notion:

```bash
python .claude/skills/mrs/skills/exporting-commits-to-notion/export_commits.py verify <out-dir> <n> <fetched-page-file>
```

`<n>` is the commit's number from the render listing.

## Files

| File | For |
|---|---|
| `SKILL.md` | Claude's instructions |
| `export_commits.py` | Renders the pages from git and checks what Notion stored |
| `README.md` | This guide |

`import-notion-commits` imports `export_commits.py` for the page format, so keep the two skill folders side by side.
