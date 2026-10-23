"""Django settings for the OIPay backend.

Key points:
- Database is configured via env vars (Postgres).
- DRF auth/permissions are disabled for MVP (no login).
- `.env` is loaded for local development convenience.
"""

from pathlib import Path
import os
import sys

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load env files for local development convenience.
# Priority: process env > backend/.env > repo-root .env
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR.parent / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-insecure-secret-key-change-me')
DEBUG = os.environ.get('DJANGO_DEBUG', '1') == '1'
ALLOWED_HOSTS = [h for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'oipay.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'oipay.wsgi.application'
ASGI_APPLICATION = 'oipay.asgi.application'

running_pytest = any('pytest' in arg for arg in sys.argv) or 'PYTEST_CURRENT_TEST' in os.environ
db_engine = os.environ.get('DB_ENGINE', '').strip().lower()
if not db_engine:
    db_engine = 'sqlite' if running_pytest else 'postgres'
if running_pytest and db_engine == 'postgres' and os.environ.get('PYTEST_USE_POSTGRES') != '1':
    db_engine = 'sqlite'
if db_engine == 'sqlite':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': os.environ.get('SQLITE_PATH', BASE_DIR / 'db.sqlite3'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            # Keep legacy database credentials so existing OIPay installations reconnect.
            'NAME': os.environ.get('POSTGRES_DB', 'splittogether'),
            'USER': os.environ.get('POSTGRES_USER', 'splittogether'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'splittogether'),
            'HOST': os.environ.get('POSTGRES_HOST', 'localhost'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [],
}

if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
