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
