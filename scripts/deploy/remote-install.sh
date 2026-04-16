#!/usr/bin/env bash
# Run on the server as root after /opt/great-scene is populated (web/ + deploy/).
set -euo pipefail

ROOT=/opt/great-scene
WEB="$ROOT/web"
COMPOSE_REL=deploy/docker-compose.prod.yml
ENV_FILE="$WEB/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy deploy/env.example and set secrets." >&2
  exit 1
fi

id -u greatscene &>/dev/null || useradd -r -s /usr/sbin/nologin -d "$ROOT" -M greatscene || \
  useradd -r -s /bin/false -d "$ROOT" greatscene

mkdir -p "$ROOT"
chown -R greatscene:greatscene "$ROOT"
chmod 600 "$ENV_FILE" 2>/dev/null || true

cd "$ROOT"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_REL" up -d

runuser -u greatscene -- env HOME="$ROOT" PATH="/usr/local/bin:/usr/bin:/bin" bash -lc "
set -euo pipefail
cd \"$WEB\"
set -a
# shellcheck disable=SC1090
source ./.env
set +a
# Install devDependencies too (Tailwind/PostCSS); .env may set NODE_ENV=production.
npm ci --include=dev
npx prisma migrate deploy
export NODE_ENV=production
rm -rf .next
npm run build
npm prune --omit=dev
"

install -m 644 "$ROOT/deploy/great-scene.service" /etc/systemd/system/great-scene.service
systemctl daemon-reload
systemctl enable great-scene.service
systemctl restart great-scene.service

if [[ -f "$ROOT/deploy/nginx-great-scene.conf" ]] && [[ ! -e /etc/nginx/sites-enabled/great-scene ]]; then
  cp "$ROOT/deploy/nginx-great-scene.conf" /etc/nginx/sites-available/great-scene
  ln -sf /etc/nginx/sites-available/great-scene /etc/nginx/sites-enabled/great-scene
  nginx -t
  systemctl reload nginx
fi

echo "great-scene: Next on 127.0.0.1:3002; public http if nginx:8081"
systemctl --no-pager status great-scene.service || true
