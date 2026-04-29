from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Python Playwright BDD workspace with pytest.")
    parser.add_argument("--collect-only", action="store_true", help="Collect tests without running them.")
    args, remaining = parser.parse_known_args()

    command = ["pytest", "-q"]
    if args.collect_only:
        command.append("--collect-only")
    command.extend(remaining)
    raise SystemExit(subprocess.call(command, cwd=Path(__file__).resolve().parents[1]))


if __name__ == "__main__":
    main()
