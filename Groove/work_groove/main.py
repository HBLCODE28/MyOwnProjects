from pathlib import Path
import sys

PACKAGE_PARENT = Path(__file__).resolve().parent.parent
if str(PACKAGE_PARENT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_PARENT))


def main() -> int:
    try:
        from music_downloader_app.qt_app import main as run_app
    except ModuleNotFoundError as exc:
        if exc.name == "PySide6":
            print("PySide6 is not installed.")
            print("Run: py -3 -m pip install -r requirements.txt")
            return 1
        raise
    run_app()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
