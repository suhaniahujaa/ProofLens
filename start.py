"""Beginner-friendly setup: python start.py. Creates an isolated environment once."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid
import venv

ROOT = Path(__file__).resolve().parent

PROBE = ("import json,sys; print(json.dumps({'version': list(sys.version_info[:2]), "
         "'version_full': sys.version, 'base_prefix': sys.base_prefix, 'executable': sys.executable}))")


def interpreter_details(command):
    """Ask the actual interpreter, rather than assuming .venv uses the caller's version."""
    try:
        result = subprocess.run([*command, "-I", "-c", PROBE], check=True,
                                capture_output=True, text=True, timeout=15)
        details = json.loads(result.stdout)
        if (len(details["version"]) != 2 or not isinstance(details["base_prefix"], str)
                or not isinstance(details["executable"], str)):
            return None
        return details
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        return None


def supported(version):
    return (3, 11) <= tuple(version) < (3, 15)


def find_compatible_python(platform_name=None):
    """Prefer the tested Python 3.12 when an unsupported interpreter launches setup."""
    candidates = []
    if (platform_name or os.name) == "nt" and shutil.which("py"):
        candidates.extend([["py", "-" + version] for version in ("3.12", "3.13", "3.11", "3.14")])
    for version in ("3.12", "3.13", "3.11", "3.14"):
        found = shutil.which("python" + version)
        if found:
            candidates.append([found])
    for command in candidates:
        details = interpreter_details(command)
        if details and supported(details["version"]):
            return details["executable"]
    return None


def matching_environment(details):
    if not details or tuple(details["version"]) != tuple(sys.version_info[:2]):
        return False
    return os.path.normcase(os.path.abspath(details["base_prefix"])) == os.path.normcase(os.path.abspath(sys.base_prefix))


def prepare_environment(root):
    environment = root / ".venv"
    executable = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    details = interpreter_details([str(executable)]) if executable.exists() else None
    if matching_environment(details):
        print("Step 1/3: Using the existing Python environment.", flush=True)
        return executable, details
    if environment.is_symlink():
        raise OSError("The .venv folder is a symbolic link. Run setup with a normal project-local environment.")
    if environment.exists():
        # Retain the old generated environment rather than deleting any of its contents.
        backup = root / (".venv-previous-" + uuid.uuid4().hex[:8])
        environment.rename(backup)
        old = ".".join(map(str, details["version"])) if details else "an unreadable interpreter"
        print(f"The cached environment used {old}. It was moved to {backup.name}.", flush=True)
    print(f"Step 1/3: Creating an environment with Python {sys.version_info.major}.{sys.version_info.minor}.", flush=True)
    venv.EnvBuilder(with_pip=True).create(environment)
    details = interpreter_details([str(executable)])
    if not matching_environment(details):
        raise OSError("The new environment does not match the selected Python. Close other app terminals and try again.")
    return executable, details


def main() -> int:
    print("\n  PROOFLENS\n  Find the evidence behind a message.\n", flush=True)
    if not supported(sys.version_info[:2]):
        compatible = find_compatible_python()
        if compatible:
            print("Selecting an installed Python version compatible with this project's libraries...", flush=True)
            return subprocess.call([compatible, str(ROOT / "start.py"), *sys.argv[1:]], cwd=ROOT)
        print("This dependency set needs Python 3.11-3.14. Python 3.12 is recommended.\n"
              "On Windows, list installed versions with: py -0p\n"
              "If Python 3.12 is installed, run: py -3.12 start.py")
        return 1
    os.chdir(ROOT)
    if not (ROOT / ".env").exists():
        shutil.copyfile(ROOT / ".env.example", ROOT / ".env")
    try:
        executable, details = prepare_environment(ROOT)
        fingerprint = hashlib.sha256((ROOT / "requirements.txt").read_bytes()
                                     + json.dumps(details, sort_keys=True).encode()).hexdigest()
        stamp = ROOT / ".venv" / "prooflens-dependencies.txt"
        if not stamp.exists() or stamp.read_text() != fingerprint:
            print("Step 2/3: Installing ready-made project libraries. Internet is needed for this first setup.\nPlease keep this window open.\n", flush=True)
            subprocess.check_call([str(executable), "-m", "pip", "install", "--only-binary=:all:", "--disable-pip-version-check", "-r", str(ROOT / "requirements.txt")])
            stamp.write_text(fingerprint)
        else:
            print("Step 2/3: Libraries are already installed.", flush=True)
        print("Step 3/3: Starting your app...\n", flush=True)
        return subprocess.call([str(executable), str(ROOT / "run.py"), *sys.argv[1:]], cwd=ROOT)
    except (OSError, subprocess.CalledProcessError) as exc:
        print("\nSetup could not finish. Read the error above.\n"
              "On Windows, use your installed Python 3.12: py -3.12 start.py\n"
              "If a file is in use, close older ProofLens terminals and retry.\n"
              "More help is in START_HERE.html.\n", flush=True)
        return 1
    except KeyboardInterrupt:
        print("\nProofLens stopped. Your saved sources and history remain in the data folder.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
