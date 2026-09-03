"""Structured logging plumbing: request correlation, JSON output, scrubbing.

Imported by `logging.config.dictConfig` during `django.setup()` — BEFORE the
app registry is populated. Nothing here may import `django.conf.settings`, a
models module, or `config.celery` at module scope. `current_task` is imported
inside `ContextFilter.filter` for exactly that reason.

CONVENTIONS.md § 10 is the policy this module makes mechanical. PROD-1
(Story 88); see CONVENTIONS.md § 34 for the whole mechanism.
"""

import json
import logging
import re
import uuid
from contextvars import ContextVar

# Set by apps.core.middleware.RequestIDMiddleware, read by ContextFilter.
# A ContextVar rather than a thread-local: this project serves ASGI (daphne,
# COMM-3), where one thread can interleave requests.
request_id_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_var: ContextVar[int | None] = ContextVar("user_id", default=None)

# A client-proposed id must look like this or it is replaced. Unvalidated
# header text in a log line is log injection — CONVENTIONS.md § 10.
ID_RE = re.compile(r"\A[A-Za-z0-9._-]{8,64}\Z")

# CONVENTIONS.md § 10 lines 161-165, made mechanical. Matched against the
# KEY NAME in a structured `extra`, case-insensitively, as a substring.
SENSITIVE_KEY_RE = re.compile(
    r"password|passwd|secret|token|api[_-]?key|authorization|credential|cookie|session",
    re.IGNORECASE,
)
REDACTED = "[redacted]"

# Everything `logging` puts on a LogRecord itself. Anything NOT here came from
# a call site's `extra=`, and is what we serialise as structured fields.
RESERVED = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "message",
        "module",
        "msecs",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "stacklevel",
        "thread",
        "threadName",
        "taskName",
        "request_id",
        "user_id",
        "celery_task_id",
        "celery_task",
    }
)


def new_request_id() -> str:
    return uuid.uuid4().hex


def get_request_id() -> str:
    return request_id_var.get()


def scrub(value):
    """Redact by key name, recursively.

    Values are never inspected — a scrubber that guesses at value shapes both
    over- and under-redacts.
    """
    if isinstance(value, dict):
        return {
            key: (REDACTED if SENSITIVE_KEY_RE.search(str(key)) else scrub(item))
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [scrub(item) for item in value]
    return value


class ContextFilter(logging.Filter):
    """Attach request/task correlation to every record.

    Registered on the HANDLER, not on a logger: that way `apps.*`, `django.*`,
    `config.*` and `celery.*` all get it without four separate declarations.
    Every attribute is set unconditionally — the `text` formatter references
    `{request_id}`, and a `{}`-style format naming an attribute a record does
    not carry raises on EVERY line, not just the uncorrelated ones.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        # Authoritative: the ContextVar is the request, whatever a call site
        # may have put in `extra`. These two names are reserved (§ 34).
        record.request_id = request_id_var.get()
        record.user_id = user_id_var.get()
        # The task fields are different: a call site inside a task may already
        # know its own id (config/celery.py::debug_task), so resolve from
        # `current_task` only to FILL a gap, never to clobber what was passed.
        task_id = getattr(record, "celery_task_id", None)
        task_name = getattr(record, "celery_task", None)
        if task_id is None or task_name is None:
            try:
                # Function-local: see the module docstring.
                from celery import current_task

                if current_task is not None and getattr(current_task, "request", None):
                    task_id = task_id or current_task.request.id
                    task_name = task_name or current_task.name
            except Exception:
                # Correlation must never suppress the line it was decorating.
                pass
        record.celery_task_id = task_id
        record.celery_task = task_name
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line. There is no JSON formatter in the stdlib."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("request_id", "user_id", "celery_task_id", "celery_task"):
            value = getattr(record, key, None)
            if value:
                payload[key] = value
        for key, value in record.__dict__.items():
            if key not in RESERVED and not key.startswith("_"):
                payload[key] = scrub(value)
        if record.exc_info:
            payload["exc_type"] = record.exc_info[0].__name__
            payload["exc"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = self.formatStack(record.stack_info)
        # default=str: a UUID, Decimal, or datetime in `extra` must not turn a
        # log call into a TypeError raised from inside the logging machinery.
        # ensure_ascii=False: this app is bilingual (CONVENTIONS.md § 18) and
        # an Arabic subject in a message must stay readable, not become \uXXXX.
        return json.dumps(payload, default=str, ensure_ascii=False)
