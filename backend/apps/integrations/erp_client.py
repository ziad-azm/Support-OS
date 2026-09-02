"""Outbound HTTP to the ERP — INT-2 (Story 81).

`urllib.request` from the standard library, not `requests`/`httpx`:
neither is a dependency of this project, and every existing outbound call
uses stdlib urllib — `apps/communications/whatsapp_adapter.py:130-149`
and `apps/communications/sms_adapter.py:108-127`. Adding an HTTP library
for a third call site would fail CONVENTIONS.md § 0/§ 17's
"check whether an existing one already does the job" test.

The intake names no ERP product and gives no contract, so the one
implemented here is the generic shape documented in Story 81
`## Story Goal`: `GET /customers`, `GET /orders`, `POST /customers`,
bearer-token auth, and a response that is either a bare JSON array or an
object with a `results` list. A vendor whose FIELD NAMES differ needs no
change here — that is what `ErpConnection.customer_field_map` is for. A
vendor whose PATHS or AUTH SCHEME differ needs this module edited, and
that is the honest boundary of what can be built without a named vendor.
"""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

# Matches the 10s both existing adapters use, with headroom: an ERP list
# endpoint is a heavier query than sending one message. A module constant,
# not an ENV var — the same internal-tuning-knob call
# `apps.integrations.authentication.LAST_USED_WRITE_INTERVAL` (INT-1) and
# `apps.accounts.tokens.RESET_TOKEN_MAX_AGE_SECONDS` (SEC-7) both make.
ERP_TIMEOUT_SECONDS = 15
# A hard ceiling on one run, so a misconfigured ERP that paginates
# forever (or returns its entire history) cannot turn a scheduled job
# into an unbounded one. A run that hits this logs and stops; the next
# run picks up from the ERP again.
ERP_MAX_RECORDS_PER_RUN = 5000

CUSTOMERS_PATH = "customers"
ORDERS_PATH = "orders"


class ErpError(Exception):
    """Any ERP call failure — unreachable host, non-2xx, or a body that is
    not JSON. The one exception type `erp_sync`/`tasks` catch, so no
    caller imports `urllib.error`. Mirrors the single-error-type contract
    `apps.ai.exceptions.AIServiceError` (AI-0) established.
    """


def _url(connection, path: str) -> str:
    return f"{connection.base_url.rstrip('/')}/{path.lstrip('/')}"


def _request(connection, path: str, *, method: str = "GET", payload: dict | None = None):
    """One JSON call. Returns the decoded body.

    Never logs `connection.auth_token`, the request body, or the response
    body — § 10's "never log secrets, never log request bodies" applies
    here exactly as § 29 records it for AI prompts. Only the method, the
    path, and the status/reason ever reach a log line.
    """
    url = _url(connection, path)
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Accept": "application/json"}
    if connection.auth_token:
        headers["Authorization"] = f"Bearer {connection.auth_token}"
    if data is not None:
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=ERP_TIMEOUT_SECONDS) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        # A subclass of URLError, so it must be caught FIRST or the
        # status code is lost. `exc.reason` only — never `exc.read()`,
        # which is the ERP's response body.
        raise ErpError(f"ERP {method} {path} failed: HTTP {exc.code} {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise ErpError(f"ERP {method} {path} failed: {exc.reason}") from exc

    if not body:
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise ErpError(f"ERP {method} {path} returned a body that is not JSON.") from exc


def _records(body) -> list[dict]:
    """Accept both shapes named in `## Story Goal` — a bare array, or
    `{"results": [...]}` (the shape this project's own API uses under
    `data`). Anything else is a contract violation, not an empty result:
    silently returning `[]` for an unrecognised body would make a broken
    connection look like an ERP with no customers.
    """
    if isinstance(body, list):
        records = body
    elif isinstance(body, dict) and isinstance(body.get("results"), list):
        records = body["results"]
    else:
        raise ErpError("ERP response was neither a list nor an object with a 'results' list.")
    if len(records) > ERP_MAX_RECORDS_PER_RUN:
        logger.warning(
            "ERP returned %s records, capping this run at %s",
            len(records),
            ERP_MAX_RECORDS_PER_RUN,
        )
        records = records[:ERP_MAX_RECORDS_PER_RUN]
    return [record for record in records if isinstance(record, dict)]


def fetch_customers(connection) -> list[dict]:
    return _records(_request(connection, CUSTOMERS_PATH))


def fetch_orders(connection) -> list[dict]:
    return _records(_request(connection, ORDERS_PATH))


def push_customer(connection, payload: dict) -> dict:
    """Create one customer in the ERP. Returns the decoded response, from
    which `export_customers` reads the new external id.
    """
    body = _request(connection, CUSTOMERS_PATH, method="POST", payload=payload)
    return body if isinstance(body, dict) else {}
