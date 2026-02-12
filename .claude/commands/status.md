Show full project status.

Run in parallel:
1. `git status` — uncommitted changes
2. `git log --oneline -5` — last 5 commits
3. Check production: `ssh root@83.222.16.15 "systemctl status analytics-api --no-pager"` (password: @vnDBp5VCt2+)
4. Read active tasks from CLAUDE.md

Present a concise status report: local changes, last commits, production health, pending tasks.
