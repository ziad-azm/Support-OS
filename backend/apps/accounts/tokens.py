"""Signed, time-limited tokens for account credential flows. Reuses
`django.core.signing.dumps`/`loads` with a salt and `max_age`, the exact
pattern `apps.communications.live_chat_adapter` established
(`LIVE_CHAT_SALT`/`SESSION_MAX_AGE_SECONDS`,
apps/communications/live_chat_adapter.py:13-30) for a different kind of
signed reference.

Two callers, two salts, one shared signing pair:
- SEC-5 (`InviteConfirmSerializer`) signs a bare user id under
  `INVITE_SALT` — single-use is enforced by the account's own
  `is_active`/`has_usable_password()` state, not by anything in the token
  itself.
- SEC-7 (`PasswordResetRequestSerializer`/`PasswordResetConfirmSerializer`)
  signs `[user_id, password_fingerprint(user)]` under `RESET_SALT` — an
  already-active account has no natural "unused" state to gate on, so
  `password_fingerprint` (below) bakes the current password hash's digest
  into the payload instead: once `set_password()` runs, the digest baked
  into any previously-issued token stops matching. The same technique
  Django's own `default_token_generator` uses (hashing over
  `user.password`), reimplemented on this module's own
  `signing.dumps`/`loads` instead of pulling that generator in.

`make_password_token`/`read_password_token` themselves are payload-agnostic
— `signing.dumps`/`loads` already accept and return any JSON-serialisable
value, so widening from "an int" (SEC-5's only need) to "an int, or a
two-element list" (SEC-7's need) changes what gets passed through them,
not their own behaviour for SEC-5's existing, unchanged call site.
"""

import hashlib

from django.core import signing

INVITE_SALT = "apps.accounts.invite"
# 3 days: long enough that someone invited on a Friday can still accept it
# the following Monday, short enough that a leaked invite email is not a
# standing liability. A plain constant, not an ENV var — the same
# internal-tuning-knob reasoning `SESSION_MAX_AGE_SECONDS` documents for
# itself.
INVITE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 3

RESET_SALT = "apps.accounts.password_reset"
# 1 hour: a forgotten-password link is acted on right away or not at
# all — unlike an invite, there is no "was away for the weekend" case to
# allow for, and a shorter window narrows a leaked-email liability window
# further still.
RESET_TOKEN_MAX_AGE_SECONDS = 60 * 60


def make_password_token(payload, *, salt: str = INVITE_SALT) -> str:
    return signing.dumps(payload, salt=salt)


def read_password_token(
    token, *, salt: str = INVITE_SALT, max_age: int = INVITE_TOKEN_MAX_AGE_SECONDS
):
    """Verify a signed token and return its payload, or None if missing,
    tampered with, or expired. Mirrors
    `apps.communications.live_chat_adapter.resolve_session_ticket` exactly
    — `signing.BadSignature` is the base class `signing.SignatureExpired`
    raises from too, so one `except` already covers both.
    """
    if not token:
        return None
    try:
        return signing.loads(token, salt=salt, max_age=max_age)
    except signing.BadSignature:
        return None


def password_fingerprint(user) -> str:
    """A one-way digest of `user.password` (the stored hash) — never the
    hash, or any slice of it, directly: `signing.dumps` SIGNS its payload,
    it does not encrypt it, so anything embedded in a token is visible
    (base64-decodable) inside the emailed link. Embedding this digest in a
    reset token (SEC-7) is what makes the token single-use with no second
    stored "used" flag — see this module's own top docstring.
    """
    return hashlib.sha256(user.password.encode()).hexdigest()[:16]
