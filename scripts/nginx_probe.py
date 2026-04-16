import os
import paramiko

def main() -> None:
    pw = os.environ.get("SSH_ROOT_PASSWORD")
    if not pw:
        print("Set SSH_ROOT_PASSWORD")
        return
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("212.108.83.176", username="root", password=pw, timeout=30, allow_agent=False, look_for_keys=False)

    def run(cmd: str) -> str:
        _, stdout, stderr = c.exec_command(cmd, timeout=60)
        return (stdout.read() + stderr.read()).decode("utf-8", errors="replace")

    print(run("ss -tlnp | grep -E ':8081|:3002' || echo PORTS_FREE"))
    print("--- sites-enabled ---")
    print(run("ls -la /etc/nginx/sites-enabled/"))
    print(run("sh -c 'for f in /etc/nginx/sites-enabled/*; do echo \"###\" \"$f\"; head -100 \"$f\"; done'"))
    c.close()


if __name__ == "__main__":
    main()
