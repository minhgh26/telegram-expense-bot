---
name: mp-implement
description: "Implement a spec, or one or more issues/tickets (e.g. \"implement #83\"), test-first, then commit and hand off the review."
---

Implement the work described by the user in the spec or tickets.

Use /mrs:mp-tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Commit your work to the current branch. Commit message should contain issue number.

## Hand off the review

Reviewing is a fresh run, not the tail of this one. A context still holding every
decision you just made reads the diff as obviously correct; /clear is what makes the
review read the code rather than remember writing it.

So stop after the commit and tell the user:

> Done and committed at `<sha>`. Run `/clear`, then `/mrs:mp-code-review <fixed-point>`.

`<fixed-point>` is the commit the work started from, so the user pastes one line
instead of digging for the ref.
