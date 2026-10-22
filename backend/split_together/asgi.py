"""ASGI entrypoint for async servers.

Used by ASGI servers (e.g., uvicorn/daphne). Not required for basic `runserver`.
"""

import os
import sys
from pathlib import Path

from django.core.asgi import get_asgi_application

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'split_together.settings')

application = get_asgi_application()
