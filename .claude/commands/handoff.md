Queue a handoff for Claude to work later — do NOT do the task now, just write the file.

Write a markdown file to `groups/telegram_main/handoffs/queue/<short-kebab-name>.md` (relative to the nanoclaw repo root; create the directory if it doesn't exist) describing the task below. Include:

- **What Johnny asked for**
- **Relevant context** — file paths, hosts, current state, constraints
- **What Claude needs to do** — specific enough that Claude can act without follow-up questions

Then confirm the filename you wrote. Claude picks these up and works them when Johnny says "check que".

$ARGUMENTS
