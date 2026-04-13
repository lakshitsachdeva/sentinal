#!/usr/bin/env python3
"""Three-node DNS IDS lab orchestrator.

Node roles:
- client: normal + attack DNS traffic generators
- defender: live capture + feature extraction + detection pipeline
- server: API service (+ optional dashboards)
"""
from __future__ import annotations

import argparse
import platform
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _spawn(cmd: list[str], name: str) -> subprocess.Popen:
    print(f"[start] {name}: {' '.join(cmd)}")
    return subprocess.Popen(cmd, cwd=ROOT)


def _terminate_all(procs: list[tuple[str, subprocess.Popen]]) -> None:
    for name, p in procs:
        if p.poll() is None:
            print(f"[stop] {name} (pid={p.pid})")
            try:
                p.terminate()
            except Exception:
                pass
    time.sleep(1)
    for _, p in procs:
        if p.poll() is None:
            try:
                p.kill()
            except Exception:
                pass


def parse_args() -> argparse.Namespace:
    default_iface = "lo0" if platform.system().lower() == "darwin" else "eth0"
    p = argparse.ArgumentParser(description="Run three-node DNS IDS lab")
    p.add_argument("--duration", type=int, default=180, help="Traffic generation duration seconds")
    p.add_argument("--interface", default=default_iface, help="Capture interface")
    p.add_argument("--api-port", type=int, default=8000)
    p.add_argument("--start-streamlit", action="store_true")
    p.add_argument("--start-react", action="store_true")
    p.add_argument("--react-port", type=int, default=3000)
    p.add_argument("--attack-mode", choices=["beacon", "exfil", "dga", "full"], default="full")
    p.add_argument("--skip-api", action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    py = str(ROOT / ".venv" / "bin" / "python")
    if not Path(py).exists():
        py = sys.executable

    procs: list[tuple[str, subprocess.Popen]] = []

    def _cleanup(*_):
        _terminate_all(procs)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, _cleanup)
    signal.signal(signal.SIGTERM, _cleanup)

    try:
        if not args.skip_api:
            procs.append(("server-api", _spawn([py, "api/server.py", "--port", str(args.api_port)], "server-api")))

        if args.start_streamlit:
            procs.append(("server-streamlit", _spawn([py, "-m", "streamlit", "run", "dashboard/app.py"], "server-streamlit")))

        if args.start_react:
            react_cmd = ["npm", "start"]
            env_cmd = ["/bin/zsh", "-lc", f"cd {ROOT / 'showcase'} && PORT={args.react_port} npm start"]
            print(f"[start] server-react: {' '.join(env_cmd)}")
            procs.append(("server-react", subprocess.Popen(env_cmd)))

        procs.append(
            (
                "client-normal",
                _spawn(
                    [
                        py,
                        "lab/normal_traffic.py",
                        "--duration",
                        str(args.duration),
                        "--interface",
                        args.interface,
                        "--log-file",
                        "data/raw/normal_live.csv",
                        "--domains-file",
                        "data/top1000_domains.txt",
                    ],
                    "client-normal",
                ),
            )
        )

        procs.append(
            (
                "client-attack",
                _spawn(
                    [
                        py,
                        "lab/attack_simulator.py",
                        "--mode",
                        args.attack_mode,
                        "--duration",
                        str(args.duration),
                        "--c2-domain",
                        "labdomain.internal",
                    ],
                    "client-attack",
                ),
            )
        )

        cycles = max(1, args.duration // 30)
        print(f"[start] defender-live: interface={args.interface}, cycles={cycles}")
        defender = subprocess.run(
            [
                py,
                "run_pipeline.py",
                "--mode",
                "live",
                "--interface",
                args.interface,
                "--cycles",
                str(cycles),
            ],
            cwd=ROOT,
        )

        if defender.returncode != 0:
            print("[warn] live capture failed. Falling back to demo mode to keep pipeline active.")
            subprocess.run([py, "run_pipeline.py", "--mode", "demo", "--no-dashboard"], cwd=ROOT)

        print("[done] three-node lab run completed")
    finally:
        _terminate_all(procs)


if __name__ == "__main__":
    main()
