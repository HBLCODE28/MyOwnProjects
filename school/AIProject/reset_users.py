import argparse
import getpass
import os
import re
import sys
from datetime import datetime

from werkzeug.security import generate_password_hash

from app import APP_TIMEZONE, User, app, db, ensure_database_schema


def parse_args():
    parser = argparse.ArgumentParser(
        description="Delete all BeatSense users and create one admin account."
    )
    parser.add_argument("--username", required=True, help="New admin username.")
    parser.add_argument("--email", required=True, help="New admin email.")
    parser.add_argument(
        "--password",
        help="New admin password. Prefer BEATSENSE_ADMIN_PASSWORD in Colab so the command is less likely to hang.",
    )
    return parser.parse_args()


def read_password(cli_password):
    if cli_password:
        return cli_password

    env_password = os.environ.get("BEATSENSE_ADMIN_PASSWORD", "")
    if env_password:
        return env_password

    if not sys.stdin.isatty():
        raise SystemExit(
            "Admin password was not provided. In Colab, run:\n"
            "import os\n"
            "os.environ['BEATSENSE_ADMIN_PASSWORD'] = 'your-strong-password'\n"
            "Then run reset_users.py again without --password."
        )

    return getpass.getpass("Admin password: ")


def main():
    args = parse_args()
    username = args.username.strip()
    email = args.email.strip().lower()
    password = read_password(args.password)

    if len(username) < 3:
        raise SystemExit("Admin username must be at least 3 characters.")
    if username.lower() in {"admin", "administrator", "manager"}:
        raise SystemExit("Use a less obvious admin username.")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise SystemExit("Admin email is not valid.")
    if len(password) < 8:
        raise SystemExit("Admin password must be at least 8 characters.")

    with app.app_context():
        ensure_database_schema()
        deleted_count = User.query.count()
        User.query.delete()
        admin = User(
            username=username,
            email=email,
            password=generate_password_hash(password),
            is_admin=True,
            onboarding_step=0,
        )
        db.session.add(admin)
        db.session.commit()

    print(
        f"Deleted {deleted_count} users and created admin '{username}' at "
        f"{datetime.now(APP_TIMEZONE).strftime('%Y-%m-%d %H:%M:%S')}."
    )


if __name__ == "__main__":
    main()
