"""Project-level URL routing.

Mounts the `core` app under `/api/` and keeps the admin under `/admin/`.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
]
