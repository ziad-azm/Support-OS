"""Signed, time-limited tokens for account credential flows — SEC-5's
invite-confirm token. Reuses `django.core.signing.dumps`/`loads` with a
salt and `max_age`, the exact pattern `apps.communications.live_chat_adapter`
established (`LIVE_CHAT_SALT`/`SESSION_MAX_AGE_SECONDS`,
apps/communications/live_chat_adapter.py:13-30) for a different kind of
signed reference. SEC-7 (forgot-password, backlog — see
`.squad/plans/security-administration/00-overview.md`) is expected to reuse
`make_password_token`/`read_password_token` unmodified with its own salt,
per this story's own intake: "the token mechanism the Password
Self-Service epic's forgot-password story reuses".
"""

from django.core import signing

INVITE_SALT = "apps.accounts.invite"
# 3 days: long enough that someone invited on a Friday can still accept it
# the following Monday, short enough that a leaked invite email is not a
# standing liability. A plain constant, not an ENV var — the same
# internal-tuning-knob reasoning `SESSION_MAX_AGE_SECONDS` documents for
# itself.
INVITE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 3


def make_password_token(user_id: int, *, salt: str = INVITE_SALT) -> str:
    return signing.dumps(user_id, salt=salt)


def read_password_token(
    token: str, *, salt: str = INVITE_SALT, max_age: int = INVITE_TOKEN_MAX_AGE_SECONDS
) -> int | None:
    """Verify a signed token and return the user id it names, or None if
    missing, tampered with, or expired. Mirrors
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
