#!/bin/bash
# Serverda ishga tushiring: bash scripts/server_deploy.sh
set -euo pipefail

REPO="${HOME}/isp-web"
WEB="/var/www/energohealth-predict.uz"
API_URL="https://api.energohealth-predict.uz"

echo "=== EnergoHealth-Predict deploy ==="
mkdir -p "$REPO" "$WEB"

if [ ! -d "$REPO/.git" ]; then
  git clone https://github.com/riskgroup77/isp2.git "$REPO"
fi

cd "$REPO"
git fetch origin main
git reset --hard origin/main
echo "VITE_API_URL=${API_URL}" > .env.local

export NODE_OPTIONS=--max-old-space-size=4096
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build

sudo rm -rf "${WEB:?}/"*
sudo cp -r dist/* "$WEB/"
sudo chown -R www-data:www-data "$WEB" 2>/dev/null || true

# Frontend nginx
sudo tee /etc/nginx/sites-available/energohealth-predict.uz > /dev/null <<'NGX'
server {
    listen 80;
    listen [::]:80;
    server_name energohealth-predict.uz www.energohealth-predict.uz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name energohealth-predict.uz www.energohealth-predict.uz;

    ssl_certificate /etc/letsencrypt/live/energohealth-predict.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/energohealth-predict.uz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/energohealth-predict.uz;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /assets/ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGX

sudo ln -sf /etc/nginx/sites-available/energohealth-predict.uz /etc/nginx/sites-enabled/energohealth-predict.uz

# API nginx (8013 proxy) — agar yo'q bo'lsa
if [ ! -f /etc/nginx/sites-available/api.energohealth-predict.uz ]; then
  sudo tee /etc/nginx/sites-available/api.energohealth-predict.uz > /dev/null <<'NGXAPI'
server {
    listen 443 ssl http2;
    server_name api.energohealth-predict.uz;

    ssl_certificate /etc/letsencrypt/live/energohealth-predict.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/energohealth-predict.uz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8013;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
NGXAPI
  sudo ln -sf /etc/nginx/sites-available/api.energohealth-predict.uz /etc/nginx/sites-enabled/
fi

sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "=== Tekshiruv ==="
curl -s http://127.0.0.1:8013/health || echo "API 8013: DOWN — docker konteynerni tekshiring"
curl -s -o /dev/null -w "Frontend HTTPS: %{http_code}\n" https://energohealth-predict.uz/ -k || true
curl -s "${API_URL}/health" || true
echo "Deploy tugadi."
