"""
Обновить код приложения на сервере без удаления /opt/great-scene и без перезаписи web/.env.
Требует: SSH_ROOT_PASSWORD. После распаковки: prisma migrate deploy, сборка, restart great-scene.
"""
from __future__ import annotations

import io
import os
import tarfile
from pathlib import Path

import paramiko

HOST = "212.108.83.176"
USER = "root"
ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
REMOTE = "/opt/great-scene"
EXCLUDE = {"node_modules", ".next", ".git"}


def add_tree(tar: tarfile.TarFile, src: Path, arc_prefix: str) -> None:
    for p in src.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(src)
        if any(part in EXCLUDE for part in rel.parts):
            continue
        if rel.parts[0] == ".env" or "/.env" in rel.as_posix():
            continue
        tar.add(p, arcname=f"{arc_prefix}/{rel.as_posix()}")


def main() -> None:
    pw = os.environ.get("SSH_ROOT_PASSWORD")
    if not pw:
        raise SystemExit("Set SSH_ROOT_PASSWORD")

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        add_tree(tar, WEB, "web")
    data = buf.getvalue()
    print(f"Tarball: {len(data) / 1024 / 1024:.2f} MiB")

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=pw, timeout=120, allow_agent=False, look_for_keys=False)
    sftp = c.open_sftp()
    sftp.putfo(io.BytesIO(data), "/tmp/great-scene-web.tgz")
    sftp.close()

    cmds = rf"""
set -euo pipefail
mkdir -p {REMOTE}
tar -xzf /tmp/great-scene-web.tgz -C {REMOTE}
chown -R greatscene:greatscene {REMOTE}/web
runuser -u greatscene -- env HOME={REMOTE} PATH="/usr/local/bin:/usr/bin:/bin" bash -lc '
set -euo pipefail
cd {REMOTE}/web
set -a
test -f .env && source .env
set +a
npm ci --include=dev
npx prisma migrate deploy
export NODE_ENV=production
rm -rf .next
npm run build
npm prune --omit=dev
'
systemctl restart great-scene.service
sleep 2
systemctl is-active great-scene
curl -sI -m 5 http://127.0.0.1:3002/lab/fandoms | head -5 || true
"""
    _, stdout, stderr = c.exec_command(cmds, timeout=600000)
    out = (stdout.read() + stderr.read()).decode("utf-8", errors="replace")
    print(out.encode("ascii", errors="replace").decode("ascii"))
    code = stdout.channel.recv_exit_status()
    c.close()
    if code != 0:
        raise SystemExit(f"Remote failed: {code}")
    print("OK.")


if __name__ == "__main__":
    main()
