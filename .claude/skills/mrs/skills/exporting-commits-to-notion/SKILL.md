---
name: exporting-commits-to-notion
description: Export git commits to Notion, one child page per commit under a main page, keeping each commit's message and a unified diff of every file it changed.
disable-model-invocation: true
argument-hint: <notion-page-url> <commit|A..B>...
---

# Exporting commits to Notion

Each commit becomes a child page of the main page, titled with its subject. The page holds the commit's author and date, its full message, then every file the commit touched as a unified diff against its first parent, in the `### `path`` + code block layout that `import-notion-commits` reads back and applies.

The pages are built by a script. The one step that isn't mechanical is copying each page into the Notion call, and that step is where content drifts. So the finish line for every commit is a **round-trip**: fetch the page back from Notion and have the script compare it with git.

`import-notion-commits` rebuilds each commit by applying its diff and committing normally — it does not try to give the rebuilt commit the same id it has here, only the same resulting code.

Arguments: the main page URL, then commit ids or ranges in any order.

## 1. Render

From inside the repo, into a fresh directory outside it (your scratchpad):

```bash
python .claude/skills/mrs/skills/exporting-commits-to-notion/export_commits.py render <out-dir> <rev>... [--exclude <path-substring>]
```

It orders commits oldest-first by topology and splits each page into part files of up to 25,000 characters, so each part fits one `cat` and one call. It writes a `manifest.json` and lists every commit with its number and part files. A binary file, a non-UTF-8 file, a submodule pointer, or a diff over 25,000 characters is listed as not included, with an instruction: supply a copy at import time, or (for a removed file too large to diff) delete it after import. If the user wants a large diff anyway, add `--max-file-chars`. Its part then prints past Bash's 30,000-character limit, so print it in line ranges with `sed -n`.

**Done when** it exits 0 and the listing names every commit the user asked for. If a line reads `WILL NOT ROUND-TRIP`, stop and show it to the user.

Show the user the listing. If the total runs past 100,000 characters, confirm before sending: every character passes through your own output. Point out any commit whose line says `needs on import: ...` — those files won't be part of the rebuilt code unless the importing side supplies or deletes them.

## 2. Resolve the main page

`notion-fetch` the main page URL. This confirms that you have access and lists its existing child `<page>` titles. If a commit's title is already there, ask the user whether to replace that page's content or skip the commit.

A same-titled page may be **half-sent** (an interrupted run leaves only part 1). Fetch it and compare with the manifest's part count before deciding: if it is only missing later parts, append them instead of recreating the page. Run `verify` before calling it done either way.

**Do the whole export inline, in this session.** Don't delegate the sending to a fork or background agent, and don't set up `/loop` or `ScheduleWakeup` to wait on one. In a past run the first fork returned having done nothing, and the second died on the account's spend limit partway through commit 11 and stalled the export for 14 hours. Sending by hand costs about 3–5 minutes per commit, so a fork saves nothing.

## 3. Send each commit, oldest first

Work in manifest order, so the child pages appear in commit order. Send each part **verbatim**: print it with `cat`, not Read, because Read adds line-number prefixes. A leading `\` before ``` or `### ` inside a code block is the script's escape, not a typo, so keep it.

- Part 1: `notion-create-pages` with `parent: {"page_id": <main page id>}`, `properties.title` from the manifest, `content`: the part, and `allow_async: false`, so the call returns the page URL.
- Each later part: `notion-update-page` with `command: "insert_content"`, `position: {"type": "end"}`, `content`: the part.

## 4. Verify each page

`notion-fetch` the page. A large page's result is saved to a file, and the tool's message names the path. Pass that saved `.json` straight to `verify`: it accepts the raw result and extracts `<content>…</content>` itself. Otherwise (a small page comes back inline), Write the fetched text **verbatim** to `<out-dir>/fetched-<n>.md`, once. Then:

```bash
python .claude/skills/mrs/skills/exporting-commits-to-notion/export_commits.py verify <out-dir> <n> <fetched-file>
```

**Never hand-retype a fetched page to build that file.** Typing 25,000 characters back out is slow (about 2 minutes per page) and your own transcription errors show up as false mismatches that look like Notion drift. If `verify` reports a mismatch, suspect your copy first: compare against the raw result before touching the Notion page.

**Done when** every commit prints `OK`. If a commit prints `FAILED`, resend it: `replace_content` with part 1, then append the rest, and verify again. If the same file fails a second time, Notion is rewriting something the script doesn't undo. Stop and report the line that `verify` names.

To repair a page with `notion-update-page` `update_content` instead, send **one** `{old_str, new_str}` item per call. A multi-item `content_updates` list fails. If more than a couple of edits are needed, use `replace_content` rather than patching.

## 5. Report

List each child page's title and URL, plus anything not included and why. Mention that a merge commit's diff is against its first parent, so `import-notion-commits` can only replay it onto a branch that already sits at that parent.
