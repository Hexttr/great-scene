"""
Pack web/ + scripts/deploy, upload to the server, write .env, run remote-install.sh.
Requires env: SSH_ROOT_PASSWORD. Optional: GEMINI_API_KEY (written into remote .env).
"""
from __future__ import annotations

import base64
import io
import os
import secrets
import tarfile
from pathlib import Path

import paramiko

HOST = "212.108.83.176"
USER = "root"
ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
DEPLOY_SRC = ROOT / "scripts" / "deploy"
REMOTE_ROOT = "/opt/great-scene"
EXCLUDE_DIRS = {"node_modules", ".next", ".git"}


def add_tree(tar: tarfile.TarFile, src: Path, arc_prefix: str) -> None:
    for p in src.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(src)
        if any(part in EXCLUDE_DIRS for part in rel.parts):
            continue
        tar.add(p, arcname=f"{arc_prefix}/{rel.as_posix()}")


def build_tar_bytes() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        add_tree(tar, WEB, "web")
        add_tree(tar, DEPLOY_SRC, "deploy")
    return buf.getvalue()


def main() -> None:
    pw = os.environ.get("SSH_ROOT_PASSWORD")
    if not pw:
        raise SystemExit("Set SSH_ROOT_PASSWORD")
    gemini = os.environ.get("GEMINI_API_KEY", "")
    pg_pass = secrets.token_urlsafe(24)

    # NODE_ENV is set by systemd (great-scene.service); omit here so npm ci installs devDeps for build.
    env_body = (
        "POSTGRES_USER=greatscene\n"
        f"POSTGRES_PASSWORD={pg_pass}\n"
        "POSTGRES_DB=greatscene\n"
        f"DATABASE_URL=postgresql://greatscene:{pg_pass}@127.0.0.1:5434/greatscene\n"
        f"GEMINI_API_KEY={gemini}\n"
    )

    data = build_tar_bytes()
    print(f"Tarball size: {len(data) / 1024 / 1024:.2f} MiB")

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=pw, timeout=120, allow_agent=False, look_for_keys=False)
    sftp = c.open_sftp()
    sftp.putfo(io.BytesIO(data), "/tmp/great-scene.tgz")
    sftp.close()

    b64 = base64.b64encode(env_body.encode("utf-8")).decode("ascii")
    cmds = f"""
set -e
rm -rf {REMOTE_ROOT}
mkdir -p {REMOTE_ROOT}
tar -xzf /tmp/great-scene.tgz -C {REMOTE_ROOT}
echo {b64} | base64 -d > {REMOTE_ROOT}/web/.env
chmod 600 {REMOTE_ROOT}/web/.env
chmod +x {REMOTE_ROOT}/deploy/remote-install.sh
bash {REMOTE_ROOT}/deploy/remote-install.sh
"""
    _, stdout, stderr = c.exec_command(cmds, timeout=600000)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out.encode("ascii", errors="replace").decode("ascii"))
    print(err.encode("ascii", errors="replace").decode("ascii"))
    exit_code = stdout.channel.recv_exit_status()
    c.close()
    if exit_code != 0:
        raise SystemExit(f"Remote script failed with code {exit_code}")
    print("Done.")


if __name__ == "__main__":
    main()
