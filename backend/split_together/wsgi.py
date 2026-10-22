"""WSGI entrypoint for traditional servers.

Used by WSGI servers (e.g., gunicorn). `runserver` ultimately relies on this style.
"""

import os
import sys
from pathlib import Path

from django.core.wsgi import get_wsgi_application

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'split_together.settings')

application = get_wsgi_application()
