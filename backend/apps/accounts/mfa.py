"""TOTP secret encryption, code generation/verification, and recovery-code
hashing — SEC-9 (Two-Factor Authentication).

The TOTP secret is the one stored credential in this codebase that must be
DECRYPTED again later (every code verification needs the raw secret) — see
CONVENTIONS.md §36 for why every other stored credential
(`EmailProviderConfig.host_password`, `ErpConnection.auth_token`) stays
plain-text-but-write-only instead, and why `ApiKey.hashed_key` (a one-way
sha256 digest) cannot substitute here. `cryptography`'s `Fernet` is added
for this reason alone — the first encryption-at-rest in this codebase.

Recovery codes are the opposite case: verified by comparison only, never
read back, so they follow `apps.integrations.keys`'s `hash_api_key`/
`secrets_match` pattern exactly (plain sha256 + `hmac.compare_digest`, no
slow KDF) rather than `django.contrib.auth.hashers` — the code is already
40 bits of `secrets.token_hex` output, so there is no low-entropy guess
space a slow hash would meaningfully protect, the same reasoning
`apps.accounts.tokens.password_fingerprint` and `apps.integrations.keys`
both document for themselves.
"""

import hashlib
import hmac
import secrets

import pyotp
from cryptography.fernet import Fernet
from django.conf import settings

RECOVERY_CODE_COUNT = 10


def _fernet() -> Fernet:
    return Fernet(settings.MFA_ENCRYPTION_KEY)


def encrypt_secret(raw_secret: str) -> str:
    return _fernet().encrypt(raw_secret.encode()).decode()


def decrypt_secret(encrypted_secret: str) -> str:
    """Raises `cryptography.fernet.InvalidToken` if `MFA_ENCRYPTION_KEY` has
    changed since the secret was encrypted, or the stored value is corrupt.
    Callers treat that the same as "no working secret" — see the plan's
    `## Edge Cases`.
    """
    return _fernet().decrypt(encrypted_secret.encode()).decode()


def generate_totp_secret() -> str:
    """160 bits — `pyotp.random_base32`'s own default and minimum; it raises
    `ValueError` below 32 base32 characters ("Secrets should be at least
    160 bits"), verified against the installed 2.10.0 source.
    """
    return pyotp.random_base32()


def provisioning_uri(user, raw_secret: str) -> str:
    return pyotp.TOTP(raw_secret).provisioning_uri(name=user.email, issuer_name="SupportOS")


def verify_totp_code(raw_secret: str, code: str) -> bool:
    """`valid_window=1` accepts the previous and next 30-second step too —
    tolerates ordinary clock drift between the server and an authenticator
    app without widening the window so far that a guessed code has a
    meaningfully larger chance of landing inside it.
    """
    return pyotp.TOTP(raw_secret).verify(code, valid_window=1)


def generate_recovery_codes(count: int = RECOVERY_CODE_COUNT) -> list[str]:
    """Each code is 10 hex characters (40 bits) from `secrets.token_hex` —
    the same "already high-entropy, no KDF needed" reasoning
    `apps.integrations.keys.hash_api_key` documents for its own secret. Ten
    is an arbitrary, common count — the intake does not specify one.
    """
    return [secrets.token_hex(5) for _ in range(count)]


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def recovery_code_matches(stored_hash: str, code: str) -> bool:
    """Constant-time comparison — mirrors `apps.integrations.keys.secrets_match`
    exactly, for the same timing-attack reason.
    """
    return hmac.compare_digest(stored_hash, hash_recovery_code(code))
