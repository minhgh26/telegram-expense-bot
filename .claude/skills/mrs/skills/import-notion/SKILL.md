---
name: import-notion
description: Imports a Notion page's file-name-plus-code-block export (headings like "### `path`" each followed by a fenced code block) into the working tree as real files. Use when the user gives a Notion page URL/ID and asks to import, pull, or vendor code or files from it, or names this file-per-block Notion convention.
---

## Process

### 1. Fetch the page

Call `mcp__claude_ai_Notion__notion-fetch` with the URL or ID (load it via `ToolSearch` first if deferred). These pages run large — expect the result to exceed the inline token limit and get saved to a file instead; that's the normal path, not a failure. Take the saved file path from the tool's error message.

### 2. Extract the file blocks

Run:

```
node .claude/skills/mrs/skills/import-notion/extract.js <fetched-file> <target-dir> --list
```

`--list` previews names and byte counts without writing anything.

**Completion criterion:** the script's own status line reads `OK: N file blocks parsed from N headers`. A naive "stop at the first fence" parser truncates any file whose own content embeds a complete code-fence example (a doc showing a snippet) — that bug is why this is a checked-in script and not something to re-derive with a regex each time. If the script reports `MISMATCH`, stop and inspect the named header by hand before writing anything; don't paper over it.

### 3. Review anything that auto-executes

Before writing files under `.claude/` (hooks, `settings.json`) or any other location that runs without further confirmation (CI config, git hooks), read their actual content from the extraction preview or the fetched file. Flag to the user, before writing, anything doing more than it plainly claims — an unfamiliar network host, credential handling, a destructive command.

### 4. Write

Re-run the same command without `--list`.

### 5. Verify

`git status --short` for the shape of the change, then read at least one long or doc-heavy imported file end to end — those are the ones most likely to have carried an embedded fence. A plausible-looking size is not proof the file wasn't cut mid-content; only reading the tail confirms it ends where the source did, not where a fence happened to fall.

### 6. Report and stop

Summarize what changed (new vs. modified paths, anything auto-executing that got added). Leave the change unstaged and uncommitted unless the user separately asks for that.
