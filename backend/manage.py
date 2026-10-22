#!/usr/bin/env python
"""Django management entrypoint.

Lets you run commands like `runserver`, `migrate`, `makemigrations`, etc.
"""

import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'split_together.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
