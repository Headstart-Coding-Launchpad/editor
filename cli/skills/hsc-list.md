# HSC: List Published Content

> **Install as slash command:** copy to `.claude/commands/hsc-list.md` and invoke with `/hsc-list`

Print a summary of everything currently published to the live app.

## Steps

1. Run both list commands in parallel:
   ```
   node cli/cli.mjs lessons list
   node cli/cli.mjs topics list
   ```

2. Summarise the results in a readable table:
   - Lessons grouped by type (python / html / scratch / filesystem), with ID and task count
   - Topics with ID, title, and category

3. Report the totals: X lessons (N python, N html, …), Y topics.

If either command fails with a credentials error, remind the user to check `cli/.env`.
