# Bet Manage Agent Notes

## Project

Bet Manage is a multi-user sports betting management app.

- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Frontend: React, TypeScript, Vite
- Deployment: Ubuntu bare metal with systemd and Nginx
- GitHub: https://github.com/kmshanq1/bet_manage
- Production URL: http://10.0.0.251
- SSH alias for server: `ubuntu251`

## Repository Layout

- `backend/`: FastAPI app, database models, routers, Alembic migrations, tests
- `frontend/`: React app for ledger, stats, and admin user management
- `deploy/`: Ubuntu deployment docs plus `systemd` and Nginx templates
- `README.md`: local development and production entry points

## Important Production Paths

- App root: `/opt/bet_manage`
- Backend service: `bet-manage`
- Backend environment file: `/etc/bet-manage.env`
- Frontend static files: `/var/www/bet_manage`
- Nginx site config: `/etc/nginx/sites-available/bet-manage`

Do not commit production secrets. The real database password, app secret, and initial admin password live only on the server.

## Common Commands

Local frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run build
```

Backend tests on Ubuntu:

```bash
cd /opt/bet_manage/backend
sudo -u betmanage .venv/bin/python -m pytest
```

Deploy frontend change to Ubuntu:

```bash
cd /opt/bet_manage/frontend
npm run build
sudo rsync -a dist/ /var/www/bet_manage/
```

Restart backend:

```bash
sudo systemctl restart bet-manage
sudo systemctl status bet-manage
```

Check production health:

```bash
curl -fsS http://127.0.0.1/api/health
curl -fsS http://10.0.0.251/api/health
```

Apply database migrations:

```bash
cd /opt/bet_manage/backend
sudo -u betmanage bash -lc 'set -a; source /etc/bet-manage.env; set +a; .venv/bin/alembic upgrade head'
```

## Current Behavior Notes

- Users log in with username and password.
- Admins can create users, enable/disable users, and view all users' betting data.
- Regular users can only manage their own bets.
- Bet records support single bets and parlays.
- The new bet form has a required date-only bet date field at the top.
- The bet date defaults to the current local date and can be edited.
- The frontend sends the selected bet date at local `00:00:00`.
- The new bet form uses these manual-entry fields: bet date, bet type, sport type, odds, stake, information source, result, calculated profit/loss, and notes.
- Bet type options are `欧盘`, `亚盘`, `大小`, `角球`, and `其他`.
- Sport type options are `足球`, `篮球`, and `其他`.
- New bet result options are `赢`, `输`, `赢半`, and `输半`; `走水` and `取消` are not shown in the new bet form.
- Odds and stake inputs select their text on focus and reject values less than or equal to zero.
- The ledger record area is a paginated table with configurable page size and inline edit/delete actions per row.
- The stats page shows period summary cards for `当日`, `本周`, and `本月`.
- The stats page includes win-rate pies for overall, football, and basketball; `赢半` counts as win and `输半` counts as loss.
- The stats page replaces the old bucket tables with 20-day charts:
  - A stacked bar chart for daily bet count, split by football and basketball.
  - A profit/loss line chart with amount y-axis labels and hover tooltips for date and profit/loss amount.
- First version is manual-entry only; no external sportsbook or score API integration.

## Verification History

- Production backend health check passed at `http://10.0.0.251/api/health`.
- `bet-manage` and `nginx` were active after deployment.
- Backend tests passed on Ubuntu: `3 passed`.
- Frontend production build passed after the latest stats chart changes.
- Latest frontend chart changes were deployed to `http://10.0.0.251` and pushed to GitHub.

## Maintenance Notes

- Prefer small commits and push to `main`.
- Keep `.env`, local databases, virtualenvs, `node_modules`, and `dist` out of git.
- Use Alembic for schema changes; do not manually edit production schema.
- When changing frontend, build locally first, then rebuild on Ubuntu and sync `dist/`.
- When changing backend dependencies, update `backend/requirements.txt` and reinstall in `/opt/bet_manage/backend/.venv`.
