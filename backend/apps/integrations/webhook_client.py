"""Outbound HTTP to a webhook subscriber — INT-4 (Story 83).

`urllib.request` from the standard library, the same choice
`apps/integrations/erp_client.py` (Story 81) and both
`apps/communications/{whatsapp,sms}_adapter.py` (pre-Story-82) already
made — no `requests`/`httpx` dependency exists in this project or is
added here (CONVENTIONS.md § 0/§ 17).
"""

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

# Matches the 10s `whatsapp_adapter`/`sms_adapter` already use for a
# single outbound call — a webhook POST is the same shape of request,
# unlike ERP's heavier list-fetch (15s, erp_client.py).
WEBHOOK_TIMEOUT_SECONDS = 10
# A hard ceiling on a stored response body — a debugging aid, not an
# unbounded archive of whatever an external system chooses to return.
RESPONSE_BODY_MAX_CHARS = 2000

SIGNATURE_HEADER = "X-SupportOS-Signature"
EVENT_HEADER = "X-SupportOS-Event"
DELIVERY_ATTEMPT_HEADER = "X-SupportOS-Delivery-Attempt"


class WebhookError(Exception):
    """Any delivery failure — unreachable host, non-2xx, or a network
    timeout. The one exception type `tasks.deliver_webhook` catches, the
    same single-error-type contract `apps.integrations.erp_client.ErpError`
    (Story 81) already established.
    """


def sign_payload(secret: str, body: bytes) -> str:
    """The exact `sha256=<hex>` shape this project already verifies
    *inbound* for Meta's `X-Hub-Signature-256`
    (`apps.communications.whatsapp_adapter.verify_signature`) — reused
    here for the *outbound* direction, same primitive.
    """
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def send_webhook(subscription, event: str, payload: dict, attempt: int) -> tuple[int, str]:
    """POSTs `payload` to `subscription.target_url`, signed with
    `subscription.secret`. Returns `(status_code, response_body)` on any
    HTTP response — including a non-2xx one, which the caller decides
    whether to treat as a failure (see `tasks.deliver_webhook`). Only a
    connection-level failure (no response at all) raises `WebhookError`
    directly from here.
    """
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        EVENT_HEADER: event,
        DELIVERY_ATTEMPT_HEADER: str(attempt),
        SIGNATURE_HEADER: sign_payload(subscription.secret, body),
    }
    request = urllib.request.Request(
        subscription.target_url, data=body, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=WEBHOOK_TIMEOUT_SECONDS) as response:
            return response.status, response.read().decode(errors="replace")[
                :RESPONSE_BODY_MAX_CHARS
            ]
    except urllib.error.HTTPError as exc:
        # A subclass of URLError, so it must be caught FIRST or the status
        # code is lost — the same ordering `erp_client.py` documents for
        # itself. A non-2xx response IS a response — surface it as a
        # WebhookError so the caller retries, but keep the code/reason.
        body_text = exc.read().decode(errors="replace")[:RESPONSE_BODY_MAX_CHARS]
        raise WebhookError(f"HTTP {exc.code} {exc.reason}: {body_text}") from exc
    except urllib.error.URLError as exc:
        raise WebhookError(str(exc.reason)) from exc
