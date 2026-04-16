import os
import paramiko

def main() -> None:
    pw = os.environ["SSH_ROOT_PASSWORD"]
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        "212.108.83.176",
        username="root",
        password=pw,
        timeout=120,
        allow_agent=False,
        look_for_keys=False,
    )
    cmds = r"""
set -e
runuser -u greatscene -- env HOME=/opt/great-scene PATH="/usr/local/bin:/usr/bin:/bin" bash -lc '
set -euo pipefail
cd /opt/great-scene/web
set -a
source ./.env
set +a
npm ci --include=dev
npx prisma migrate deploy
export NODE_ENV=production
rm -rf .next
npm run build
npm prune --omit=dev
test -f .next/BUILD_ID && echo BUILD_OK || (echo NO_BUILD_ID; exit 1)
'
systemctl restart great-scene.service
sleep 2
systemctl --no-pager status great-scene.service
curl -sI -m 5 http://127.0.0.1:3002/lab | head -8 || true
"""
    _, stdout, stderr = c.exec_command(cmds, timeout=600000)
    print((stdout.read() + stderr.read()).decode("utf-8", errors="replace"))
    c.close()


if __name__ == "__main__":
    main()
