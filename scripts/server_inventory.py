"""One-off read-only server inventory. Run: python scripts/server_inventory.py"""
import paramiko

HOST = "212.108.83.176"
USER = "root"
# Password from env to avoid shell escaping issues
import os

def main() -> None:
    pw = os.environ.get("SSH_ROOT_PASSWORD")
    if not pw:
        print("Set SSH_ROOT_PASSWORD")
        return
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=pw, timeout=30, allow_agent=False, look_for_keys=False)

    def run(cmd: str) -> str:
        _, stdout, stderr = c.exec_command(cmd, timeout=120)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        return out + (err if err.strip() else "")

    sections = [
        ("=== OS ===", "cat /etc/os-release 2>/dev/null | head -6; uname -a"),
        ("=== CPU MEM ===", "nproc; echo ---; free -h; echo ---; uptime"),
        ("=== DISK ===", "df -hT"),
        ("=== LISTEN TCP ===", "ss -tlnp 2>/dev/null || true"),
        ("=== DOCKER ===", "docker ps -a 2>/dev/null; echo DOCKER_EXIT:$?"),
        (
            "=== SYSTEMD RUNNING ===",
            "systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -70",
        ),
        ("=== TOP MEM ===", "ps aux --sort=-%mem 2>/dev/null | head -28"),
        (
            "=== WEB STACK ===",
            "systemctl is-active nginx 2>/dev/null; systemctl is-active apache2 2>/dev/null; "
            "command -v nginx apache2 caddy 2>/dev/null; true",
        ),
        ("=== NODE PM2 ===", "command -v node; node -v 2>/dev/null; pm2 list 2>/dev/null || true"),
        ("=== DB PORTS ===", "ss -tlnp 2>/dev/null | head -80"),
    ]
    for title, cmd in sections:
        print(title)
        try:
            print(run(cmd))
        except Exception as e:
            print("ERR", e)
        print()
    c.close()


if __name__ == "__main__":
    main()
