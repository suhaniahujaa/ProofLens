"""Run after installing requirements, or use start.py for automatic first setup."""
import argparse
from pathlib import Path
import socket
import sys
import threading
import time
import webbrowser


def main():
    parser = argparse.ArgumentParser(description="Start the local ProofLens app.")
    parser.add_argument("--port", type=int, default=8000, help="Local port (default: 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser automatically")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Choose a port between 1024 and 65535.")
    try:
        import uvicorn
    except ImportError:
        print("First run: python start.py")
        return 1
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", args.port))
        except OSError:
            print(f"Port {args.port} is already being used.\nStop the old app, or run: python start.py --port {args.port + 1}")
            return 1
    address = f"http://127.0.0.1:{args.port}"
    print(f"\n  Open: {address}\n  Keep this terminal open. Press Ctrl+C to stop.\n", flush=True)

    def open_when_ready():
        for _ in range(60):
            try:
                with socket.create_connection(("127.0.0.1", args.port), timeout=.3):
                    pass
                webbrowser.open(address)
                return
            except OSError:
                time.sleep(.3)

    if not args.no_browser:
        threading.Thread(target=open_when_ready, daemon=True).start()
    uvicorn.run("prooflens.app:app", host="127.0.0.1", port=args.port,
                app_dir=str(Path(__file__).parent), log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
