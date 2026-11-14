---
name: deliver
description: Deliver one issue end to end with sub-agents (implement, review, fix), then tick its met acceptance criteria, comment what's worth knowing, and close it.
disable-model-invocation: true
---

Deliver the issue the user names (`/mrs:deliver #83`). You are the **orchestrator**: three
fresh sub-agents do the code work in sequence, and you do the issue-tracker work yourself.

Chain the steps: when a sub-agent reports, start the next step in the same turn. The user
hears from you at a **stop** or in the final report.

## Stops

Stop only when the next move is the user's call, and put it to them as options with your
recommendation:

- The issue is closed or missing, or it has no acceptance criteria.
- The working tree is dirty at the start, which would muddy the fixed point.
- A sub-agent can't finish: a gate stays red, or tooling it needs is down.
- A fix would widen the issue's scope, contradict its spec, or change what an ADR decides.

Everything else has a default below. Take it, and list it in the final report.

## Gates

A sub-agent's gate result is a claim. Take a green one as given. Re-run the full gate
yourself, once, only when a sub-agent reports it red, calls a failure flaky, or reports
something that contradicts the diff. The gate is green only if you or the agent saw it green.
A flake that passes on your re-run goes in the issue comment under **For the maintainer**,
with the test's name. A gate still red after your re-run is a **stop**.

## 1. Pin

- Read the issue (`gh issue view <n> --json number,title,state,body,labels,comments`) and note
  its acceptance criteria. Plain `--comments` can print nothing and exit 0 on some machines.
- Record the **fixed point** with `git rev-parse HEAD` before anything is committed. Every
  later step diffs against it.

## 2. Implement

Spawn a `code-implement` agent in this worktree (pass its absolute path) to invoke
`/mrs:mp-implement #<n>` through to its commit. Ask it to report the commit, the gate result with
any skipped tests named, and known limits. Its hand-off line asks for `/clear` before review;
the fresh review agent is that `/clear`.

Done when a commit sits above the fixed point and the gate is green.

## 3. Review

Spawn a fresh agent to invoke `/mrs:mp-code-review <fixed-point>` as a **review only**, with no
edits and no commits. Ask for both axes' findings in full, plus the criteria the Spec axis
found met. That skill's briefs cap each axis at 400 words and ask the Spec axis only for
gaps; tell the agent to drop the cap and add the met criteria to the Spec brief, because
step 5 ticks from that list.

## 4. Fix

If the review has nothing in the three groups below, skip this step and say so in the final
report.

Spawn a fresh `code-implement` agent with the review's findings pasted in full, correctness first. It fixes:

- every Spec finding;
- every documented-standard breach and stale doc;
- a baseline smell only where a fix above already touches that code. The rest are left alone
  on purpose and go in the comment.

It works test-first where behaviour changes, makes one new commit (never an amend), runs the
gate, and leaves the commits unpushed. It skips a finding whose fix hits a **stop** and reports
it. Ask it to report each finding as fixed or skipped with the reason, the gate result with
skipped tests named, which new tests it saw fail first (and why not for the rest), every doc or
ADR it edited, and manual steps it could not do.

A skipped finding that hits a stop is a stop for you too.

## 5. Tick the met criteria

Before ticking, spot-check the fix: for each finding the fix agent reports as fixed, open the
hunk in `git diff <fixed-point>..HEAD` that fixes it. A report is a claim, and the diff is the
evidence.

A criterion is **met** when you can name its evidence: a test in
`git diff <fixed-point>..HEAD` that ran in a green gate, or the file change that satisfies a
non-code criterion. A test the gate skipped is no evidence. Confirm each named test exists in
the diff.

Tick exactly the met criteria in the issue body (`- [ ]` to `- [x]` on those lines only),
write it back with `gh issue edit <n> --body-file`, and read it back to confirm.

## 6. Comment what's worth knowing

Every factual claim in the comment must trace to the diff, a test, or a command you ran.
Anything you have only from a sub-agent's report goes in as "the agent reports…", or stays out.

Post one comment for whoever picks up the next ticket. It holds what they need that neither
the issue nor the diff tells them:

- decisions taken that the issue didn't dictate, and the docs or ADRs edited to match;
- known limits, and what is meant to catch them;
- manual steps still open;
- findings left alone on purpose;
- criteria left unmet, by name;
- glossary terms added;
- a **For the maintainer** section, always present, holding every ask of the user: decisions
  (such as a follow-up issue you propose but have not filed), defaults to confirm, and doc or
  ADR edits to review. Write "none" when there are none.

The diff is the change list, so the comment carries none.

Anything the final report asks of the user must also sit in that section. The chat report is
gone once the session ends, and the issue is the only record the user will find later. Never
leave a proposed follow-up only in chat: name it in the comment as **Needs triage**.

## 7. Close or hold

If every criterion is met, run `gh issue close <n> --reason completed`. Otherwise leave the
issue open and treat it as a **stop**.

## Final report

- The commits, and that they are local and unpushed.
- The criteria ticked, and any left open.
- The comment link, and whether the issue closed.
- What needs the user: manual steps, doc or ADR edits to confirm, and defaults you took. This
  repeats the comment's **For the maintainer** section and adds nothing to it.
