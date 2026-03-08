Автоматический деплой. Выполнить все шаги без остановки.

Steps:
0. **Branch check**: Run `git branch --show-current`. If NOT `analitics_main_v1` — STOP and print:
   "⛔ Деплой разрешён только из ветки analitics_main_v1. Текущая ветка: {branch}. Переключись и смержи изменения перед деплоем."
   Do NOT proceed with any further steps.
1. Run `cd frontend && npm run build` — if errors, STOP and fix
2. Run `git status` and `git diff --stat` — show what changed
3. List all modified files with brief description of changes
4. Flag any potential risks: new migrations, new env vars, breaking changes
5. If there are NEW migrations — STOP and print SQL for user to apply in Supabase Dashboard first. Wait for user confirmation before continuing.
6. Deploy backend (if backend files changed):
```
sshpass -p '@vnDBp5VCt2+' rsync -avz --exclude='venv' --exclude='__pycache__' -e "ssh -o StrictHostKeyChecking=no" backend/ root@83.222.16.15:/var/www/analytics/backend/
ssh root@83.222.16.15 "systemctl restart analytics-api"
```
7. Deploy frontend:
```
sshpass -p '@vnDBp5VCt2+' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" frontend/dist/ root@83.222.16.15:/var/www/analytics/frontend/
```
8. Verify:
```
curl -s https://reviomp.ru/api/v1/health
ssh root@83.222.16.15 "journalctl -u analytics-api --no-pager -n 10"
```
9. Report result: SUCCESS or FAILED with details

IMPORTANT: Execute all deploy commands automatically. Only stop for migrations (step 5) or build errors (step 1).
