# Ubuntu Bare Metal Deployment

以下示例假设代码放在 `/opt/bet_manage`，服务账号为 `betmanage`，数据库为 PostgreSQL。

## 1. Install Packages

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nodejs npm postgresql nginx
```

## 2. Create System User

```bash
sudo useradd --system --home /opt/bet_manage --shell /usr/sbin/nologin betmanage
sudo mkdir -p /opt/bet_manage
sudo chown -R betmanage:betmanage /opt/bet_manage
```

Copy this project into `/opt/bet_manage`.

## 3. PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER bet_manage WITH PASSWORD 'change-me';
CREATE DATABASE bet_manage OWNER bet_manage;
\q
```

## 4. Backend

```bash
cd /opt/bet_manage/backend
sudo -u betmanage python3 -m venv .venv
sudo -u betmanage .venv/bin/pip install -r requirements.txt
```

Create `/etc/bet-manage.env`:

```bash
APP_NAME=Bet Manage
ENVIRONMENT=production
SECRET_KEY=replace-with-a-long-random-value
ACCESS_TOKEN_EXPIRE_MINUTES=720
DATABASE_URL=postgresql+psycopg://bet_manage:change-me@127.0.0.1:5432/bet_manage
BACKEND_CORS_ORIGINS=http://your-intranet-host
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-admin-password
```

Run migrations and create the first admin:

```bash
cd /opt/bet_manage/backend
sudo -u betmanage bash -c 'set -a; source /etc/bet-manage.env; set +a; .venv/bin/alembic upgrade head'
sudo -u betmanage bash -c 'set -a; source /etc/bet-manage.env; set +a; .venv/bin/python -m app.seed_admin'
```

Install service:

```bash
sudo cp /opt/bet_manage/deploy/bet-manage.service /etc/systemd/system/bet-manage.service
sudo systemctl daemon-reload
sudo systemctl enable --now bet-manage
sudo systemctl status bet-manage
```

## 5. Frontend

```bash
cd /opt/bet_manage/frontend
npm install
npm run build
sudo mkdir -p /var/www/bet_manage
sudo rsync -a dist/ /var/www/bet_manage/
```

## 6. Nginx

```bash
sudo cp /opt/bet_manage/deploy/nginx-bet-manage.conf /etc/nginx/sites-available/bet-manage
sudo ln -sf /etc/nginx/sites-available/bet-manage /etc/nginx/sites-enabled/bet-manage
sudo nginx -t
sudo systemctl reload nginx
```

Then visit `https://your-intranet-host`.

For an IP-only intranet deployment, create a self-signed certificate before reloading Nginx:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/bet_manage.key \
  -out /etc/nginx/ssl/bet_manage.crt \
  -subj '/CN=10.0.0.251' \
  -addext 'subjectAltName=IP:10.0.0.251,DNS:ubuntu251'
sudo chmod 600 /etc/nginx/ssl/bet_manage.key
```

Browsers will warn about self-signed certificates unless the certificate is imported into the client's trusted root store.

## Operations

- Backend logs: `journalctl -u bet-manage -f`
- Restart backend: `sudo systemctl restart bet-manage`
- Apply new migrations: `sudo -u betmanage bash -c 'cd /opt/bet_manage/backend && set -a && source /etc/bet-manage.env && set +a && .venv/bin/alembic upgrade head'`
- Rebuild frontend after changes: `cd /opt/bet_manage/frontend && npm run build && sudo rsync -a dist/ /var/www/bet_manage/`
