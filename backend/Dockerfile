# Dev-parity image for the optional Compose stack — PROD-4 (Story 93).
# Docker is NEVER required to run SupportOS; see README § Docker.
#
# Python 3.12 matches README's Prerequisites table. `-slim` floats within the
# minor version rather than pinning a Debian codename: this is a local
# convenience image, not a supply-chain-pinned production artifact.
FROM python:3.12-slim

# Unbuffered so `manage.py`/Celery logs reach `docker compose logs` immediately
# rather than sitting in a pipe buffer — PROD-1's whole access log depends on
# it being visible. No .pyc files: the source is bind-mounted and rebuilt
# constantly, so they are pure noise.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# /backend, not /app: verified live — config/tests/test_settings.py::
# BaseDirTests.test_base_dir_points_at_backend_root asserts
# `settings.BASE_DIR.name == "backend"`, and BASE_DIR is derived from
# `__file__`'s own path (config/settings/base.py), so the container's
# directory name leaks into a real, already-existing test. WORKDIR /app
# makes that test fail inside the container — confirmed by actually running
# `docker compose exec backend python manage.py test`, not assumed.
WORKDIR /backend

# Requirements first, so `pip install` is cached and does not re-run on every
# source edit. `psycopg[binary]` ships its own libpq, so no libpq-dev / no
# compiler is needed for an x86_64 build — see the story's `## Edge Cases`
# for the arm64 caveat and its one-line fix.
#
# requirements-dev.txt, not requirements.txt: it is `-r requirements.txt` plus
# ruff, and having the linter in the image is what makes
# `docker compose exec backend ruff check .` work — the point of a dev image.
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

# The real source arrives via the bind mount in docker-compose.yml; this COPY
# only makes the image runnable on its own.
COPY . .

EXPOSE 8000

# Overridden per service in docker-compose.yml (runserver / worker / beat).
# `runserver`, not a bare `daphne config.asgi:application`: base.py orders
# "daphne" first in DJANGO_APPS specifically so runserver is ASGI/WebSocket
# aware, and runserver additionally serves the static files /admin/ and
# /api/docs/ need under DEBUG.
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
