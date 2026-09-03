"""Cache access that can never take a request down. PROD-2 (Story 91).

Every read and write goes through here. A Redis outage must degrade to
"uncached", never to a 500 — the same posture `TicketViewSet.perform_create`
already takes for a Celery queue failure (apps/tickets/views.py). See
CONVENTIONS.md § 35.
"""

import hashlib
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)


def cache_get(key):
    try:
        return cache.get(key)
    except Exception:
        # Redis unreachable, timing out, or misconfigured. Not fatal: the
        # caller recomputes. Logged at WARNING, not ERROR — the request still
        # succeeds, so this is "worth noticing", CONVENTIONS.md § 10.
        logger.warning("Cache read failed for %s", key, exc_info=True)
        return None


def cache_set(key, value, ttl):
    try:
        cache.set(key, value, ttl)
    except Exception:
        logger.warning("Cache write failed for %s", key, exc_info=True)


def cache_delete(key):
    try:
        cache.delete(key)
    except Exception:
        logger.warning("Cache delete failed for %s", key, exc_info=True)


def digest(*parts: str) -> str:
    """Stable, bounded key fragment. The raw SQL of a filtered queryset is
    unbounded and contains characters memcached-style backends reject, so it
    is never used as a key directly.
    """
    joined = "\x1f".join(parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:32]
