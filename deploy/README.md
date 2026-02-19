# PlanTrip — Hetzner Deployment Guide

Deploy PlanTrip on a Hetzner Cloud VPS for ~$4/month. This guide gets you from zero to a running production app with HTTPS.

## Architecture

```
Internet
   │
   ▼
[Nginx container :80/:443]  ← serves React SPA + corporate page
   │
   ├── /api/*  → [FastAPI container :8000]
   │                    │
   │                    ▼
   │              [PostgreSQL :5432]
   │
   └── /*       → static files (React build)
```

All three services run in Docker Compose on a single VPS. Nginx handles routing, Caddy/Coolify handles SSL.

---

## Step 1: Create the Hetzner Server

1. Sign up at [console.hetzner.cloud](https://console.hetzner.cloud)
2. Create a new project → "Add Server"
3. Settings:
   - **Location:** Falkenstein (cheapest) or Helsinki (lowest latency for Nordic clients)
   - **Image:** Ubuntu 24.04
   - **Type:** CX22 (2 vCPU, 4 GB RAM, 40 GB NVMe) — EUR 3.79/month
   - **Networking:** Public IPv4 (required)
   - **SSH Key:** Add your public key (`cat ~/.ssh/id_ed25519.pub`)
   - **Name:** `plantrip`
4. Click "Create & Buy Now"
5. Note the server IP address (e.g., `65.21.xxx.xxx`)

---

## Step 2: Point Your Domain

In your DNS provider, add these records:

```
A     plantrip.yourdomain.com    →  65.21.xxx.xxx
A     www.plantrip.yourdomain.com → 65.21.xxx.xxx
```

Wait a few minutes for DNS propagation.

---

## Step 3: Initial Server Setup

SSH into your server:

```bash
ssh root@65.21.xxx.xxx
```

Run initial setup:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version

# Create a non-root user (optional but recommended)
adduser deploy
usermod -aG docker deploy

# Configure firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Step 4: Install Caddy (Reverse Proxy + Auto SSL)

Caddy automatically provisions and renews Let's Encrypt certificates.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

Create the Caddyfile:

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
plantrip.yourdomain.com {
    reverse_proxy localhost:3000
}
EOF
```

> **Replace** `plantrip.yourdomain.com` with your actual domain.

Restart Caddy:

```bash
systemctl restart caddy
systemctl enable caddy
```

Caddy will auto-provision HTTPS via Let's Encrypt when the domain is reachable.

---

## Step 5: Deploy the App

### Clone the repo

```bash
# As root or deploy user
cd /opt
git clone https://github.com/YOUR_USER/plantrip.git
cd plantrip
```

### Create production environment file

```bash
cat > .env.prod << 'EOF'
# Database
POSTGRES_USER=plantrip
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE
POSTGRES_DB=plantrip
DATABASE_URL=postgresql+asyncpg://plantrip:CHANGE_ME_STRONG_PASSWORD_HERE@db:5432/plantrip

# Auth — generate with: python3 -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET_KEY=CHANGE_ME_GENERATE_A_STRONG_SECRET

# Frontend
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_API_URL=/api
FRONTEND_URL=https://plantrip.yourdomain.com

# API Keys
UNSPLASH_ACCESS_KEY=your_unsplash_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Email (Resend)
RESEND_API_KEY=your_resend_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev

# Security
COOKIE_SECURE=true
EOF

chmod 600 .env.prod
```

> **Generate secrets** on your local machine:
> ```bash
> python3 -c "import secrets; print(secrets.token_urlsafe(48))"  # JWT_SECRET_KEY
> python3 -c "import secrets; print(secrets.token_urlsafe(24))"  # POSTGRES_PASSWORD
> ```

### Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### Verify

```bash
# Check all containers are healthy
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Check backend health
curl http://localhost:8000/health

# Check frontend serves HTML
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Check logs
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backend --tail 20
```

Visit `https://plantrip.yourdomain.com` — you should see the app with a valid SSL certificate.

---

## Step 6: Update the Nginx Config for Production

The frontend container's Nginx config already proxies `/api/` to `backend:8000`. Caddy sits in front and handles SSL termination:

```
Client → Caddy (:443 HTTPS) → Nginx (:3000 HTTP) → Backend (:8000) / Static files
```

Update the Caddyfile if you need the frontend container to receive the real client IP:

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
plantrip.yourdomain.com {
    reverse_proxy localhost:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF

systemctl reload caddy
```

---

## Step 7: Set Up Automated Backups

### Database backup script

```bash
cat > /opt/plantrip/backup.sh << 'SCRIPT'
#!/bin/bash
BACKUP_DIR="/opt/plantrip/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Dump database from the running container
docker compose -f /opt/plantrip/docker-compose.prod.yml --env-file /opt/plantrip/.env.prod \
  exec -T db pg_dump -U plantrip plantrip | gzip > "$BACKUP_DIR/plantrip_$TIMESTAMP.sql.gz"

# Keep only last 7 daily backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: plantrip_$TIMESTAMP.sql.gz"
SCRIPT

chmod +x /opt/plantrip/backup.sh
```

### Schedule daily backup via cron

```bash
crontab -e
# Add this line (runs daily at 3 AM):
0 3 * * * /opt/plantrip/backup.sh >> /var/log/plantrip-backup.log 2>&1
```

### Optional: Hetzner snapshots

In the Hetzner console, enable automatic server snapshots (EUR 0.60/month per snapshot). This backs up the entire disk including the Docker volumes.

---

## Step 8: Deploy Updates

When you push new code:

```bash
cd /opt/plantrip
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

For zero-downtime deploys, rebuild individual services:

```bash
# Frontend only (no downtime for backend)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build frontend

# Backend only (brief restart, ~5s)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build backend
```

---

## Quick Reference

| Task | Command |
|---|---|
| Start all | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d` |
| Stop all | `docker compose -f docker-compose.prod.yml --env-file .env.prod down` |
| View logs | `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f` |
| Rebuild & deploy | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` |
| DB backup now | `/opt/plantrip/backup.sh` |
| DB restore | `gunzip -c backups/plantrip_XXXXX.sql.gz \| docker compose exec -T db psql -U plantrip plantrip` |
| SSH in | `ssh root@65.21.xxx.xxx` |

---

## Monthly Cost Breakdown

| Item | Cost |
|---|---|
| Hetzner CX22 (2 vCPU, 4 GB RAM) | EUR 3.79 (~$4.10) |
| Hetzner snapshot (1 backup) | EUR 0.60 (~$0.65) |
| Caddy + Let's Encrypt SSL | Free |
| Resend emails (3,000/month) | Free |
| **Total** | **~$4.75/month** |

Well under your $10 budget with room to spare.

---

## Capacity

The CX22 with 4 GB RAM comfortably handles:
- PostgreSQL: ~200 MB RAM
- FastAPI (Uvicorn): ~150 MB RAM
- Nginx (frontend): ~20 MB RAM
- OS + Docker overhead: ~500 MB RAM
- **Free RAM: ~3 GB** — enough for 50+ concurrent users

For 10 concurrent daily users, this server is massive overkill. You won't need to upgrade until you reach 100+ concurrent users.
