from rest_framework.renderers import JSONRenderer

from .envelope import Envelope, success_envelope


class EnvelopeJSONRenderer(JSONRenderer):
    """Wrap every successful response body in the standard envelope.

    A renderer, not a helper function: a view author cannot forget to call it.
    Bodies that already are an `Envelope` — produced by the exception handler
    or by `DefaultPageNumberPagination` — pass through untouched.
    """

    def render(self, data, accepted_media_type=None, renderer_context=None):
        response = (renderer_context or {}).get("response")

        # 204 and 304 must carry an empty body.
        if response is not None and response.status_code in (204, 304):
            return b""

        if not isinstance(data, Envelope):
            data = success_envelope(data)

        return super().render(data, accepted_media_type, renderer_context)


class PlainTextRenderer:
    """Meta's WhatsApp webhook verification handshake requires the
    `hub.challenge` value echoed back as a raw string — not this API's
    envelope, which `EnvelopeJSONRenderer` would otherwise wrap it in. A
    deliberate, narrow exception to CONVENTIONS.md §11 ("the envelope is
    the only response shape") for an external protocol this project does
    not control the contract of. Used only by
    `WhatsAppInboundWebhookView.get_renderers()` (Story 15, COMM-2), and
    only for its `GET` method.
    """

    media_type = "text/plain"
    format = "txt"
    # Required by `rest_framework.response.Response.rendered_content`, which
    # reads `renderer.charset` unconditionally — verified live: omitting
    # this attribute raises `AttributeError` on every request through this
    # renderer, not just the happy path (DRF's exception handling still
    # renders the response through the negotiated renderer for an error
    # response). See Story 15 `## Prerequisites`.
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return str(data).encode("utf-8")
