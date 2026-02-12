Pre-deploy checklist. DO NOT deploy automatically. Only prepare and verify.

Steps:
1. Run `cd frontend && npm run build` — report success or errors
2. Run `git status` and `git diff --stat` — show what changed
3. List all modified files with brief description of changes
4. Flag any potential risks: new migrations, new env vars, breaking changes
5. Print the deploy commands for the user to run manually (do NOT execute them):

```
# Frontend deploy
sshpass -p '@vnDBp5VCt2+' rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" dist/ root@83.222.16.15:/var/www/analytics/frontend/

# Backend deploy (if backend changed)
sshpass -p '@vnDBp5VCt2+' rsync -avz --exclude='venv' --exclude='__pycache__' -e "ssh -o StrictHostKeyChecking=no" backend/ root@83.222.16.15:/var/www/analytics/backend/
ssh root@83.222.16.15 "systemctl restart analytics-api"
```

IMPORTANT: Never execute deploy commands. Only print them for the user.
