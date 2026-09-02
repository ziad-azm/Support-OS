"""API-key minting and verification — INT-1 (Story 80).

A key is `<prefix>.<secret>`, e.g. `sos_3f9a1c04.7b2e…` (64 hex chars of
secret). Only `prefix` and `sha256(secret)` are ever stored, so a
database dump does not yield a working key and a lost key cannot be
recovered — only replaced.

`hashlib.sha256`, not `django.contrib.auth.hashers.make_password`: the
secret is 256 bits of `secrets.token_hex` output, so there is no
low-entropy guess space for a deliberately slow KDF to defend, and a
per-request PBKDF2 verification would add its full cost to every
API-key call. The same plain-`sha256` reasoning
`apps.accounts.tokens.password_fingerprint` already records for a digest
of a stored hash.
"""

import hashlib
import hmac
import secrets

# Namespaced so a leaked string is recognisable as a SupportOS key in a
# log or a paste.
KEY_NAMESPACE = "sos"
# `.` is not in `token_hex`'s alphabet (0-9a-f), so the split below is
# unambiguous. `token_urlsafe` would NOT be: its alphabet includes `_`
# and `-`.
KEY_SEPARATOR = "."
PREFIX_BYTES = 4  # -> "sos_" + 8 hex chars = 12 characters
SECRET_BYTES = 32  # -> 64 hex chars


def generate_api_key() -> tuple[str, str, str]:
    """Mint a key. Returns `(raw_key, prefix, hashed_key)`.

    The caller stores `prefix`/`hashed_key` and hands `raw_key` back to
    the operator exactly once.
    """
    prefix = f"{KEY_NAMESPACE}_{secrets.token_hex(PREFIX_BYTES)}"
    secret = secrets.token_hex(SECRET_BYTES)
    return f"{prefix}{KEY_SEPARATOR}{secret}", prefix, hash_api_key(secret)


def hash_api_key(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def split_raw_key(raw_key: str) -> tuple[str, str] | None:
    """`(prefix, secret)` for a well-formed key, else None."""
    prefix, separator, secret = raw_key.partition(KEY_SEPARATOR)
    if not separator or not prefix or not secret:
        return None
    return prefix, secret


def secrets_match(stored_hash: str, secret: str) -> bool:
    """Constant-time comparison — `==` on a digest leaks its matching
    prefix length through timing.
    """
    return hmac.compare_digest(stored_hash, hash_api_key(secret))
