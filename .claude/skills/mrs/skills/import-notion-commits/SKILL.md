---
name: import-notion-commits
description: Rebuild commits exported by exporting-commits-to-notion onto the current branch by applying each one's diff and committing normally, so the branch ends up with the same code.
disable-model-invocation: true
argument-hint: <notion-main-page-url>
---

# Importing commits from Notion

Each page that `exporting-commits-to-notion` writes carries the commit's author, date, message and a unified diff of every file it touched. The script applies each commit's diff with `git apply`, places any supplied copies of files the page couldn't carry (or deletes a removed file too large to have shipped as a diff), stages everything, and commits with the page's recorded author and date. The rebuilt commit gets a **new id** — this does not try to match the exporting branch's ids, only its code.

The finish line: every page in the chain has been committed, and the branch's tip holds the same tree as the last exported commit.

Arguments: the main page URL, the same one the export used. Run from the repo and branch to import into.

## 1. List the commit pages

`notion-fetch` the main page. Its child `<page>` tags are the commit pages, oldest first. A page whose title already appears in `git log` on this branch is probably imported already — start fetching from the first title that isn't.

## 2. Save each page verbatim

`notion-fetch` each commit page in order. A large page's result is saved to a file, and the tool's message names the path: use that file as is. Otherwise, Write the fetched text **verbatim** to `page-NN.md` in a fresh scratchpad directory. A character that drifts in the copy can make a diff fail to apply or apply somewhere it shouldn't.

**Never retype a page, and never edit one to make it apply.** If the fetched text is no longer in front of you, fetch the page again.

## 3. Check the working tree, then replay

The repo must have no uncommitted changes before you start (the script checks and refuses otherwise).

```bash
python .claude/skills/mrs/skills/import-notion-commits/import_commits.py <page-file>... [--supply <dir>]
```

Pass the page files in main-page order. The script applies and commits each one in turn, advancing the branch as it goes. After each commit it compares the commit's message and every file's diff (file modes included) with the page, so a commit that prints its new id has been checked against its page.

An imported commit can move this skill (the path above is where it lives now). If the script is gone when you rerun, find it again with `git ls-files '*import_commits.py'`.

**Done when** it exits 0 with every page committed. When it stops partway, the commits before that point are already on the branch; it names why it stopped:

- **`patch did not apply`:** the branch's content at those lines doesn't match what the diff expects. Fetch the page again first, in case your copy drifted. If the fresh copy fails the same way, stop and show the user the page's line next to the repo's: whether to correct the page or the branch is their call. Otherwise this means either the branch has already diverged (check what's different), or — for a merge commit's page — the branch isn't at that merge's first parent (see below).
- **`git commit failed`:** a commit hook rejected the commit. The script has already undone that page's changes, so the tree is clean. Read the hook's output: if the failure has nothing to do with the page (a flaky test), rerun from that page. Never pass `--no-verify`. If it fails again, stop and report it.
- **`committed, but it differs from the page`:** the commit is on the branch and doesn't match its page at the line named. Stop and report it. Don't amend, reset or otherwise rewrite commits on the user's branch without asking.
- **`not on the page; supply a copy`:** the export left a file out (binary, non-UTF-8, a submodule, over the size cap, or excluded). Put a copy at its repo path under a directory and rerun with `--supply <dir>`, continuing from the commit it stopped at.

## 4. Report

List each imported commit's subject and new short id, and the branch's new tip. Compare the tip's tree with the exporting branch's own tip (`git diff <tip> <exported-tip> --stat` should be empty) rather than comparing ids, since the ids are intentionally not the same. If you can't reach the exporting branch, say that this comparison wasn't done. State anything that differs from a literal replay (a page that needed correcting, a hook failure and rerun) before the list, not after it. Leave pushing to the user.

## Merge commits

A merge commit's page carries its diff against its **first parent**, so it only applies cleanly when the importing branch is already at that parent commit. That's the normal case when both sides are the same branch (for example, catching a clone of `develop` up to a later point) — not when the export mixes commits from a side branch with the branch it was later merged into, since replaying the side branch's own commits moves you away from the merge's first parent. If the patch fails on a merge commit's page for that reason, either skip that page (import stops there) or handle the merge by hand once the earlier commits are in.
