# import-notion-commits

Rebuilds commits that `exporting-commits-to-notion` put in Notion onto a branch in another repo. Each page's diff is applied and committed normally, so the rebuilt commit gets a **new id** — it is not made to match the exporting branch's id. What matches is the code: after each commit, the working tree is byte-for-byte the same as it was on the exporting branch at that point.

## Before you start

- **Notion connector:** Claude Code must have it connected, with access to the main page.
- **Python 3 and git:** both on `PATH`.
- **Both skills installed side by side:** `.claude/skills/mrs/skills/exporting-commits-to-notion/` and `.claude/skills/mrs/skills/import-notion-commits/`, both project skills of this repo. Run the commands from the repo root (the importer takes `--repo DIR` for the target). The importer reads pages with the exporter's code, which owns the page format. To use them elsewhere, copy both folders.
- **A clean working tree:** commit or stash local changes before importing; `git apply` needs a tree that matches what the diff expects.
- **The right starting point:** for the diffs to apply, your branch needs to be wherever the export's own history was at that point — normally the commit right before the first exported one, on the same line of history.

## Usage

```
/mrs:import-notion-commits <notion-main-page-url>
```

| Parameter | Required | What it is |
|---|---|---|
| Notion page URL | Yes | The main page the export used. Its child pages are the commits, oldest first. |

Run it again later to pick up new pages: commits already recognizable in `git log` can be skipped by only passing the newer page files.

## How this works

Each export page carries:

- the commit's author, email and date
- its full message
- a unified diff for every file it touched, against the commit's first parent

The importer concatenates a commit's diffs into one patch and applies it with `git apply` against the current working tree — the same way `git am` would, but without needing mailbox formatting. It then commits with `git commit --author "<name> <email>" --date "<date>"`, using the page's message. The committer (name, email, timestamp) is whoever runs the import, same as any new commit you'd make yourself.

Because it's an ordinary `git apply` + `git commit`, the new commit's id depends on the current repo's parent commit, its tree, and its committer info — none of which need match the exporting side. After each commit, the importer compares the commit's message and each file's diff with the page and stops if they differ. It also sets each file's executable bit from the page's mode line, which `git apply` loses on Windows.

## What can stop the import

| Message | Meaning | What to do |
|---|---|---|
| `working tree has uncommitted changes` | You have local edits or staged changes | Commit or stash them, then rerun |
| `patch did not apply` | The current file content doesn't match what the diff's context expects | The branch has diverged from where the export assumed it would be, or you're at the wrong starting commit. For a merge commit's page, see "Merge commits" below. |
| `git commit failed` | A commit hook rejected the commit. That page's changes were undone, so the tree is clean | Fix what the hook complains about, or rerun from that page if the failure was unrelated |
| `committed, but it differs from the page` | The new commit's message or a file's diff (file mode included) doesn't match its page | Look at the line it names before importing further |
| `not on the page; supply a copy` | The export left this file out: binary, non-UTF-8, a submodule, over the size cap, or excluded | Give Claude a copy (see below) |

A file the diff doesn't need to touch is left exactly as it already is in your working tree.

### Giving Claude a missing file

Put each file at its repo path under any directory, then tell Claude where it is:

```
supply/
  docs/prototypes/surface-mockups/surface-mockups.dc.html
  src/backend/.env
```

The importer copies each one into place before committing. It trusts the copy — there's no hash to check it against, so make sure it's the version from that commit.

A page can also say to *delete* a path instead (a removed file whose diff would have been too large to ship); the importer does that automatically, no `--supply` needed.

## Merge commits

A merge commit's page shows its diff against its **first parent** — the mainline it was merged into, not the branch that was merged in. Applying that diff only makes sense when your working tree is already at that first parent. That's naturally true when you're replaying a single branch's own history (including its merge commits) onto a matching clone of that branch. It's **not** true if the exported commit list also includes the side branch's own commits just before the merge: applying those first moves your tree to the side branch's tip, not the mainline's, so the merge page's diff won't apply from there.

If that happens, the import stops at the merge commit's page with a `patch did not apply` error naming the files involved. Either stop the import before that page (you still have every commit up to it), or bring in the merge's effect by hand once you understand what it changed.

## What Claude does when you run it

1. **Lists the commit pages** from the main page, oldest first.
2. **Saves each page** exactly as Notion returns it.
3. **Applies and commits** each page in turn: `git apply`, place any supplied/deleted files, `git add -A`, `git commit --author ... --date ...`, then checks the commit against the page. Stops at the first page that fails, naming why.
4. **Reports** each commit's subject and new id, and the branch's new tip.

## Running the script by hand

With the pages saved as files, from inside the repo:

```bash
python .claude/skills/mrs/skills/import-notion-commits/import_commits.py page-01.md page-02.md ... [--supply DIR] [--repo DIR]
```

Each page it can apply becomes a real commit on the current branch right away — there's no separate preview/apply step, since (unlike the old byte-exact design) there's no object-store staging to preview. Run it against a scratch clone first if you want to look before committing on your real checkout. A page file can be the fetched page text, or the JSON result the Notion fetch tool saves for large pages.

## Files

| File | For |
|---|---|
| `SKILL.md` | Claude's instructions |
| `import_commits.py` | Applies each page's diff and commits it |
| `README.md` | This guide |
