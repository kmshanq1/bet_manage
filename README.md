# Bet Manage

多用户体育投注管理系统第一版：投注台账、单注/串关、复盘、统计、管理员账号管理。

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Frontend: React, TypeScript, Vite
- Deployment: Ubuntu bare metal, systemd, Nginx

## Local Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m app.seed_admin
uvicorn app.main:app --reload
```

Default development database is `backend/bet_manage.db`.

Default admin:

- username: `admin`
- password: `admin123456`

Override with environment variables before running `seed_admin`:

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="change-me"
```

## Local Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend proxies `/api` to `http://127.0.0.1:8000`.

## Production

See `deploy/ubuntu-baremetal.md`.
