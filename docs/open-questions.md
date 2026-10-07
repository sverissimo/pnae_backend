# Open questions

Agents record only non-blocking unknowns here, under `## <run-name>` using the
coordinator payload's name. State the question and exactly which part remains
pending. Continue independent work; never guess an answer or create a fake
implementation. Use `needs_user` when a missing decision prevents a meaningful
deliverable. A partial deliverable may be approved only with its pending scope
clearly recorded and acceptable under the task's acceptance criteria.

Use one entry per question:

```text
- Q: Which term should the optional glossary use? (pending: glossary sentence)
  Answer:
```

The user fills `Answer:` in the retained task worktree or, after finishing the
run, in this file on main. Since runs do not resume automatically, a follow-up
task must name the earlier section it should apply. Agents apply answered
entries in their own section and earlier sections named by the task. Remove an
entry only after fully applying its answer; remove empty sections. Preserve
this header and other runs' entries. Unanswered questions remain visible.
