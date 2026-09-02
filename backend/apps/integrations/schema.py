"""OpenAPI post-processing — INT-1 (Story 80).

drf-spectacular documents what a **view** returns. This project's views
return plain payloads and `apps.core.renderers.EnvelopeJSONRenderer`
wraps them, so an unmodified schema documents a body shape this API has
never sent. This hook closes that gap: every documented `2xx` payload is
nested under `data` inside the success envelope, and one shared
`ErrorEnvelope` component is attached to the status codes
`apps.core.exceptions.envelope_exception_handler` can produce.

A paginated list endpoint is already enveloped by
`DefaultPageNumberPagination.get_paginated_response_schema` (it has to
be — `meta.pagination` is a sibling of `data`, not something that can be
added from outside), so `_is_enveloped` skips it rather than nesting a
second envelope inside the first.

`nullable: True` rather than `type: ["…", "null"]`: drf-spectacular's
`OAS_VERSION` default is 3.0.3, which has no type-array form.
"""

ERROR_COMPONENT = "ErrorEnvelope"

ERROR_RESPONSES = {
    "400": "Validation or parse error. `error.fields` maps field name to messages.",
    "401": "Missing, malformed, expired, or revoked credentials.",
    "403": "Authenticated, but the caller lacks the required permission.",
    "404": "No such resource, or one outside the caller's scope.",
    "500": "Unhandled server error. `error.debug` is present only when DEBUG is on.",
}

ERROR_ENVELOPE_SCHEMA = {
    "type": "object",
    "required": ["success", "data", "error", "meta"],
    "properties": {
        "success": {"type": "boolean", "enum": [False]},
        "data": {"nullable": True},
        "error": {
            "type": "object",
            "required": ["code", "message", "fields"],
            "properties": {
                "code": {"type": "string", "example": "validation_error"},
                "message": {"type": "string", "example": "The submitted data is invalid."},
                "fields": {
                    "type": "object",
                    "additionalProperties": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "meta": {"nullable": True},
    },
}


REF_PREFIX = "#/components/schemas/"


def _resolve_ref(schema, components):
    """Follow one `$ref` level into `components.schemas`, if present.

    `DefaultPageNumberPagination.get_paginated_response_schema` is
    registered by drf-spectacular as a **named component**
    (e.g. `PaginatedTicketList`) referenced from the operation as a bare
    `{"$ref": "..."}` — it is never inlined the way a single-object
    response is. `_is_enveloped` must resolve that ref before checking
    for `success`, or it double-wraps an already-enveloped paginated
    response, burying `meta.pagination` inside `data`.
    """
    if isinstance(schema, dict) and set(schema) == {"$ref"}:
        ref = schema["$ref"]
        if ref.startswith(REF_PREFIX):
            return components.get(ref[len(REF_PREFIX) :])
    return schema


def _is_enveloped(schema, components) -> bool:
    resolved = _resolve_ref(schema, components)
    return isinstance(resolved, dict) and "success" in (resolved.get("properties") or {})


def _wrap_success(schema: dict) -> dict:
    return {
        "type": "object",
        "required": ["success", "data", "error", "meta"],
        "properties": {
            "success": {"type": "boolean", "enum": [True]},
            "data": schema,
            "error": {"nullable": True},
            "meta": {"nullable": True},
        },
    }


def envelope_postprocessing_hook(result, generator, request, public):
    components = result.setdefault("components", {}).setdefault("schemas", {})
    for path_item in result.get("paths", {}).values():
        for operation in path_item.values():
            # A path item also holds a `parameters` list, which is not an
            # operation.
            if not isinstance(operation, dict) or "responses" not in operation:
                continue
            responses = operation["responses"]
            for status_code, response in list(responses.items()):
                if not str(status_code).startswith("2"):
                    continue
                for media in (response.get("content") or {}).values():
                    schema = media.get("schema")
                    if schema is None or _is_enveloped(schema, components):
                        continue
                    media["schema"] = _wrap_success(schema)
            for status_code, description in ERROR_RESPONSES.items():
                responses.setdefault(
                    status_code,
                    {
                        "description": description,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": f"#/components/schemas/{ERROR_COMPONENT}"}
                            }
                        },
                    },
                )
    components[ERROR_COMPONENT] = ERROR_ENVELOPE_SCHEMA
    return result
