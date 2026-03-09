Показать логи production сервера.

Аргумент $ARGUMENTS может содержать: количество строк (по умолчанию 50), фильтр (error, warning, etc.)

## Шаги (параллельно):

1. Логи analytics-api (последние N строк):
```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no -p 2222 root@83.222.16.15 "journalctl -u analytics-api --no-pager -n ${LINES:-50}"
```

2. Статус сервиса:
```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no -p 2222 root@83.222.16.15 "systemctl status analytics-api --no-pager"
```

3. Nginx access log (последние 20 строк):
```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no -p 2222 root@83.222.16.15 "tail -20 /var/log/nginx/access.log"
```

## Вывод:
- Статус сервиса (active/failed)
- Последние ошибки (если есть) — выделить красным
- Последние запросы к API
- Uptime и memory usage

Если есть аргумент "error" или "ошибки" — фильтровать только ошибки:
```bash
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no -p 2222 root@83.222.16.15 "journalctl -u analytics-api --no-pager -n 200 | grep -i 'error\|traceback\|exception\|500'"
```
