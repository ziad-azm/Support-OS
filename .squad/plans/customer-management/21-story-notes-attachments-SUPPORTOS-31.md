# Story 21 — Notes & Attachments (Story: SUPPORTOS-31)

## Prerequisites

- **Story 10 (CUST-1) completed.** `Customer` (`apps/customers/models.py`, 95 lines), `BaseModelViewSet`/`BaseModelSerializer`, `apps/customers/urls.py`'s `DefaultRouter`, `CustomerProfilePage.tsx`, and `ContactDetailsSection.tsx`/`useContactDetailMutations.ts` all exist and are extended, not replaced. This is the **last** story in `customer-management` — `.squad/plans/customer-management/00-overview.md:36` already names what it owns: *"`Note` and `Attachment`, plus file upload."*
- **This is the project's first file upload, and the first model with a user-attributed field.** Verified: `grep -rn "ForeignKey(settings.AUTH_USER_MODEL\|ForeignKey(User" backend/apps --include=*.py` (excluding migrations) returns nothing — no model has ever referenced `accounts.User` before. `Note.author`/`Attachment.uploaded_by` are the first, both `SET_NULL` (nullable) — the same reasoning `Ticket.category` used (Story 18): a note's or attachment's content should survive its author's account being removed, unlike `Ticket.customer` (`PROTECT`, an identity that must not silently vanish).
- **`backend/media/` is already gitignored** — verified: `.gitignore:17`, right after `backend/staticfiles/` (line 16). This confirms `MEDIA_ROOT = BASE_DIR / "media"` was already anticipated as this story's default; no `.gitignore` edit is needed.
- **No `MEDIA_URL` is set, deliberately.** Django's static-file/media serving (`django.views.static.serve`, or a wired `MEDIA_URL` in `urls.py`) has **no permission check at all** — anyone with the URL can fetch the file. Every other read in this project is gated by `permission_map`; serving attachments the same unguarded way would be the first hole in that pattern. Attachments are downloaded exclusively through `AttachmentViewSet`'s permission-gated `download` action (task 3), which streams the file via a Django `FileResponse` instead. `MEDIA_ROOT` alone is sufficient for `FileField` to store files — `FileSystemStorage.url()` (which needs `MEDIA_URL`) is never called, because the serializer marks `file` `write_only` (task 2) and no code ever reads `.url`.
- **`FileResponse` bypasses `EnvelopeJSONRenderer` safely — verified against the installed DRF.** `rest_framework/views.py::APIView.finalize_response` (lines 423-441) only attaches the renderer/envelope machinery `if isinstance(response, Response)` (DRF's own `Response` class); its one hard requirement is `isinstance(response, HttpResponseBase)` (line 428). `django.http.FileResponse` is an `HttpResponseBase` subclass but **not** a `rest_framework.response.Response`, so returning one from `AttachmentViewSet.download` skips the envelope entirely — no `PlainTextRenderer`-style workaround needed (contrast Story 15's WhatsApp handshake, which still returned a DRF `Response` and needed one).
- **DRF's `ModelSerializer` auto-maps `models.FileField` → `serializers.FileField`** — verified: `rest_framework/serializers.py:936`. Its `to_representation` defaults to `use_url=True` (`api_settings.UPLOADED_FILES_USE_URL`, default `True`) and would call `value.url`, which raises without `MEDIA_URL` set (`FileSystemStorage.url()`'s documented behaviour). `extra_kwargs = {"file": {"write_only": True}}` (task 2) is what prevents this — a `write_only` field is skipped entirely during `to_representation` (DRF core), so `.url` is never reached.
- **DRF's `MultiPartParser` exists in the installed version** — verified: `rest_framework/parsers.py:87`. No new dependency; `apps/communications/views.py`'s `SMSInboundWebhookView` (Story 17) already established the "`parser_classes` overrides the project's JSON-only `DEFAULT_PARSER_CLASSES`, scoped to one view" pattern this story reuses on `AttachmentViewSet`.
- **`Attachment` intentionally supports no `update`/`partial_update`.** The intake's own task 2 wording is "add/list/download," not "edit" — a file's *content* cannot be sanely PATCHed, and this project's established convention (Story 11's `ContactDetailSerializer.update`) is for edits to change a value in place, which does not translate to swapping bytes on disk. `AttachmentViewSet.http_method_names` is narrowed to exclude `put`/`patch` — verified against the installed Django/DRF: `rest_framework/views.py:517` checks `request.method.lower() in self.http_method_names` inside `dispatch()`, *before* any handler or `permission_map` lookup runs, so a narrowed `http_method_names` list makes `PUT`/`PATCH` a clean `405` for every request, not merely an unmapped-but-reachable action. `Note` keeps full CRUD (`ContactDetail`'s own precedent — a text note is exactly the kind of value PATCH already handles well).
- **The exact axios+`FormData` interaction was verified against the installed library, because it silently breaks otherwise.** `httpClient` (`frontend/src/shared/lib/api/client.ts`) is created with a default `Content-Type: application/json` header. Verified: `axios/lib/defaults/index.js`'s `transformRequest` (lines 44-57) — for a `FormData` payload, `if (isFormData) { return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data; }`. Because `httpClient`'s default `Content-Type` reads as JSON, an upload call through `api.post()` with **no header override** would silently `JSON.stringify` the `FormData` instead of sending it as `multipart/form-data` — corrupting the file. `uploadAttachment.ts` (task 8) must pass `headers: { "Content-Type": undefined }` in the request config so `hasJSONContentType` is false and axios passes the native `FormData` through unchanged, letting the browser's XHR/fetch layer set the correct `multipart/form-data; boundary=...` header itself.
- **A downloaded file cannot be fetched with a plain `<a href>` link, because the API is Bearer-token authenticated, not cookie-based.** A native browser navigation attaches no `Authorization` header, so a direct link to `/api/attachments/<id>/download/` would `401`. `downloadAttachment.ts` (task 8) instead calls `httpClient.get(url, { responseType: "blob" })` — which **does** carry the request through `httpClient`'s existing Authorization interceptor — then builds a temporary `URL.createObjectURL(...)` link and clicks it programmatically. This is the standard pattern for an authenticated SPA download; it does **not** use `api.get()`, because the response body is a raw file stream, not the JSON envelope `unwrap()` expects.
- **`z.file()` already exists in the installed zod, and the project's shared error map already has copy for it.** Verified: `node_modules/zod/v4/classic/schemas.d.ts:587-594` (`ZodFile`, with `.min()`/`.max()`/`.mime()`), and `frontend/src/shared/validation/errorMap.ts:6` — `SIZED_ORIGINS = ['string', 'number', 'array', 'set', 'file']` already includes `'file'`, with `too_small.file`/`too_big.file` translation keys ready. This story uses plain `z.file()` with **no** `.min()`/`.max()`/`.mime()` constraint — see `## Edge Cases` for why a size/type cap is deliberately not added, the same "accept and document the gap" call Story 19 made for rate limiting.
- **No new permission constants.** Both `NoteViewSet` and `AttachmentViewSet` reuse `Permissions.CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE` — the intake gives no separate authorization story, and `ContactDetailViewSet` (Story 11) already established "a sub-resource of the customer record reuses the customer permission domain."

---

## Story Goal

1. **`Note` and `Attachment` models + upload API.** `Note` (customer, author, body) with full CRUD; `Attachment` (customer, uploaded_by, file, original_filename, size) with create/list/retrieve/destroy/download, no edit. File storage location documented via `MEDIA_ROOT` (`ENV`).
2. **Notes & attachments UI on the profile.** Two more cards on `CustomerProfilePage`, built from shared primitives — `NotesSection` mirrors `ContactDetailsSection`'s exact add/edit/remove `<ul>` shape; `AttachmentsSection` adds a new shared `FileField` form primitive (the project's first) and a client-side authenticated-download flow.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `Note`/`Attachment` models, `SET_NULL` author FKs | The intake's literal ask; `SET_NULL` matches `Ticket.category`'s precedent (Story 18) for a reference that should not block deletion of the thing it points to. |
| `MEDIA_ROOT` (`ENV`), no `MEDIA_URL` | "Document storage location via `ENV`" (intake, task 1) — satisfied by `MEDIA_ROOT` alone, since downloads never go through Django's own unguarded static/media serving. |
| `AttachmentViewSet.download` (`@action`, `FileResponse`) | The only way to read a file's bytes back out — permission-gated, unlike a raw `MEDIA_URL`. |
| `AttachmentViewSet.http_method_names` narrowed | "add/list/download" (intake, task 2) — no edit verb exists for a file's content. |
| `shared/ui/form/FileField.tsx` (new) | The first file-typed form field in the project; `useAppForm` stays the only form entry point (§ 20) even for a file. |
| `uploadAttachment.ts`'s explicit `Content-Type` override | Verified necessary — see `## Prerequisites`; silent corruption otherwise. |
| `downloadAttachment.ts`'s blob-fetch-then-click flow | The API is Bearer-token authenticated; a plain link cannot carry that header. |

**Not here, and why:**

- **No file size or MIME-type restriction.** `z.file()` supports both (`.max()`, `.mime()`) but neither is added — not asked for by the intake, and the project's own precedent (Story 19's undocumented rate limiting) is to accept and document a scope gap rather than invent a limit. See `## Edge Cases`.
- **No note/attachment permissions separate from `customers.*`.** Matches `ContactDetail`'s own precedent (Story 11).
- **No versioning, no edit history, no soft delete.** A deleted note or attachment is gone; matches every other domain model's hard-delete behaviour in this project.
- **No image preview/thumbnailing.** An attachment is downloaded, not previewed inline — "add/list/download" is the complete verb set the intake names.
- **No S3/cloud storage backend.** Local filesystem via Django's default `FileSystemStorage`, matching the project's own "Docker is deliberately absent" stance (`requirements.txt`'s header comment) — no new dependency.

---

## Context — Read These Files First

1. `.squad/stories/customer-management/SUPPORTOS-31/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 296-302 (`STORY (CUST-4) — Notes & Attachments`).
3. `backend/apps/customers/models.py` (95 lines) — `Customer` (no change), `ContactDetail`'s `Meta.constraints`/`related_name` shape (lines 63-96) — the structural precedent `Note`/`Attachment` follow, adapted for `CASCADE` (see task 1).
4. `backend/apps/accounts/models.py` — `User.get_full_name()` (no args, falls back to `self.email`) — the method `author_name`/`uploaded_by_name` call through DRF's dotted `source` traversal (verified safe on `None`, same mechanism as `TicketSerializer.category_name`, Story 18).
5. `backend/apps/customers/serializers.py` (93 lines, after Story 20) — `ContactDetailSerializer` (lines 56-93): no fields declared beyond `Meta` for the auto-generated FK/unique-together case, `.update()` popping `customer` to block reassignment (lines 87-93) — `NoteSerializer.update()` copies this verbatim.
6. `backend/apps/customers/views.py` (94 lines, after Story 20) — `ContactDetailViewSet.get_queryset` (the required `?customer=` filter pattern both new viewsets copy) and `CustomerViewSet.timeline` (the most recent `@action` precedent, Story 20) — the shape `AttachmentViewSet.download` follows.
7. `backend/apps/customers/urls.py` (11 lines) — the `DefaultRouter` two viewsets already share; task 3 registers two more on the same router.
8. `backend/apps/customers/admin.py` (26 lines) — `ContactDetailInline`/`ContactDetailAdmin` pair — the precedent task 1's `NoteAdmin`/`AttachmentAdmin` follow.
9. `backend/apps/customers/migrations/0002_grant_customer_permissions.py` (45 lines) — confirms `CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE` are already granted to `admin`/`manager`/`agent`; this story's migration depends on `0003_contactdetail` and adds no grant of its own.
10. `backend/config/settings/base.py` lines 157-160 (`STATIC_URL`/`STATIC_ROOT`) — the section this story's `MEDIA_ROOT` block follows in style, deliberately **not** copying the `STATIC_URL` half (see `## Prerequisites`).
11. `backend/apps/core/exceptions.py` lines 54-71 (`_to_drf_exception`) — confirms only `Http404`/`DjangoPermissionDenied`/`DjangoValidationError`/`ProtectedError` are translated; a raw filesystem error from a missing attachment file is not, and surfaces as a `500` — see `## Edge Cases`.
12. `.gitignore` lines 16-17 — `backend/staticfiles/`/`backend/media/`, confirming this story's default storage path was already anticipated.
13. `backend/.env.example` lines 44-49 (the `# --- SMS (COMM-4) ---` block, the most recent) — the format this story's `# --- Media (CUST-4) ---` block follows.
14. `README.md` line 492 (the last `SMS_*` row before the `### Frontend` section) — where task 4 appends the `MEDIA_ROOT` row.
15. `frontend/src/features/customers/components/ContactDetailsSection.tsx` (250 lines, after Story 11) — the `Card`/`QueryBoundary`/`isEmpty`/`empty`/`<ul>` shape (lines 59-88) `NotesSection`/`AttachmentsSection` both copy; `ContactDetailAddForm`/`ContactDetailEditForm` (lines 144-250) — the exact add/edit form shape `NotesSection`'s note form copies.
16. `frontend/src/features/customers/api/useContactDetailMutations.ts` (47 lines) — the scoped-invalidation (`customerKeys.resource('<resource>', customerId)`, not the whole-feature prefix) `useCreate/Update/Delete<X>` shape both `useNoteMutations.ts` and `useAttachmentMutations.ts` copy, plus its own documented reasoning for why scoped (not prefix-wide) invalidation is correct here (Story 11 `## Product rules`).
17. `frontend/src/shared/ui/form/TextField.tsx` (50 lines) — the reference field implementation; note its docstring's "`Input` is a real DOM element, so `{...field}` composes directly" claim, which `FileField.tsx` (task 5) explicitly does **not** follow, for a different, verified reason (browsers reject a scripted `value` on a file input) — see `## Prerequisites`.
18. `frontend/src/shared/ui/primitives/input.tsx` lines 10-11 — the `Input` primitive's Tailwind classes already include `file:inline-flex file:h-7 file:border-0 ...`, confirming it was already styled to accept `type="file"`; `FileField.tsx` reuses this same primitive, no new one needed.
19. `frontend/src/shared/lib/api/client.ts` — `httpClient` (the raw axios instance, exported separately from `api`) and `api.post`'s `config` passthrough — both used by `uploadAttachment.ts`/`downloadAttachment.ts`.
20. `frontend/src/shared/validation/errorMap.ts` (67 lines) — `SIZED_ORIGINS` (line 6, includes `'file'`), `isBlank`-driven "required" fallback (line 28) — confirms a bare `z.file()` (no `.min()`) already gets a translated "this field is required" message with no extra work.
21. `CONVENTIONS.md` § 17 (dependencies/`ENV` — no new package for either file upload or parsing), § 20 (`useAppForm` is the only entry point — extended here to the first file field), § 23 (feature module conventions — Story 20's paragraph is the most recent; this story's own addition appends after it).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **`Note`/`Attachment` models + upload API, storage location via `ENV`.** | Intake, task 1 | `Note`, `Attachment`, `MEDIA_ROOT = env("MEDIA_ROOT", ...)`. |
| **Add/list/download UI using shared primitives.** | Intake, task 2 | `NotesSection`, `AttachmentsSection`, the new `FileField` primitive. |
| **A file's content is never edited — delete and re-upload instead.** | This story's design | `AttachmentViewSet.http_method_names` excludes `put`/`patch`. |
| **Attachments are never served through Django's own unguarded static/media mechanism.** | This story's design, closing a real gap | No `MEDIA_URL`; `download` is a permission-gated `@action` returning `FileResponse`. |
| **`author`/`uploaded_by` are always server-set from `request.user`, never client-supplied.** | This story's design | `perform_create` on both viewsets; both fields are `read_only` on their serializers. |
| **A `FormData` upload must not be silently JSON-stringified by the shared axios instance.** | Verified, see `## Prerequisites` | `uploadAttachment.ts`'s explicit `Content-Type: undefined` override. |
| **A file download must carry the Bearer token, so it cannot be a plain link.** | This project's JWT-only auth model | `downloadAttachment.ts`'s blob-fetch-then-click flow. |
| Wire format is `snake_case` end to end. | § 12 | `original_filename`, `uploaded_by_name`, etc. |
| No new permission constant, no new dependency. | § 17, § 22 | Reuses `CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE`; `FileResponse`/`FileField`/`MultiPartParser` are all Django/DRF core. |

---

## Backend Tasks

### 1 — The `Note` and `Attachment` models

**File: `backend/apps/customers/models.py`** — append after `ContactDetail`:

```python
def attachment_upload_path(instance: "Attachment", filename: str) -> str:
    """Scoped per customer so uploads from different customers never
    collide, and so a customer's files are easy to locate on disk.
    `instance.customer_id` is already set by the time Django calls this —
    the FK is assigned before `.save()` triggers the file write.
    """
    return f"attachments/{instance.customer_id}/{filename}"


class Note(TimeStampedModel):
    """A free-text note on a customer record — CUST-4. CASCADE, not PROTECT:
    a note has no existence independent of its customer, the same reasoning
    `Message.ticket` uses (Story 13), not `Ticket.customer`'s PROTECT
    (Story 12, an identity that must survive).
    """

    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="notes", verbose_name=_("customer")
    )
    # SET_NULL: the project's second nullable FK after `Ticket.category`
    # (Story 18) — a note's content should survive its author's account
    # being removed. See Story 21 `## Prerequisites`.
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_notes",
        verbose_name=_("author"),
    )
    body = models.TextField(_("body"))

    class Meta:
        verbose_name = _("note")
        verbose_name_plural = _("notes")
        # Newest-first: a running log of context reads best with the most
        # recent entry on top, the same choice `Ticket.Meta.ordering` makes
        # (a queue), not `Message.Meta.ordering` (a conversation).
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Note on {self.customer_id}"


class Attachment(TimeStampedModel):
    """An uploaded file on a customer record — CUST-4. CASCADE for the same
    reason as `Note.customer`. No `update`/`partial_update` — see Story 21
    `## Prerequisites` for why a file's content is never edited in place.
    """

    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="attachments", verbose_name=_("customer")
    )
    uploaded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_attachments",
        verbose_name=_("uploaded by"),
    )
    file = models.FileField(_("file"), upload_to=attachment_upload_path)
    # Django's storage backend may rename the stored file to avoid a
    # collision (e.g. a second "report.pdf" for the same customer); this is
    # the name to show the user and to send back on download, independent
    # of whatever `file.name` ends up being on disk.
    original_filename = models.CharField(_("original filename"), max_length=255)
    # Bytes, captured once at upload time from the incoming UploadedFile —
    # cheaper than re-`os.path.getsize()`-ing on every list request.
    size = models.PositiveIntegerField(_("size"))

    class Meta:
        verbose_name = _("attachment")
        verbose_name_plural = _("attachments")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.original_filename
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations customers
```

Expect **one** new file, `apps/customers/migrations/0004_note_attachment.py` (or Django's equivalent auto-generated name), containing two `CreateModel` operations. Depends on `("customers", "0003_contactdetail")`. **No new permission-grant migration** — see `## Prerequisites`.

**File: `backend/config/settings/base.py`** — append after `STATIC_ROOT` (line 160):

```python
# --- Media / Attachments (CUST-4) -------------------------------------------
# Local filesystem storage — no S3/cloud dependency, matching this project's
# "Docker is deliberately absent" stance (requirements.txt). No MEDIA_URL:
# attachments are served exclusively through AttachmentViewSet.download
# (permission-gated), never through Django's own unguarded static/media
# serving. See Story 21 `## Prerequisites`.
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))
```

**File: `backend/apps/customers/admin.py`** — extend imports and register both:

```python
from django.contrib import admin

from .models import Attachment, ContactDetail, Customer, Note
```

```python
@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("customer", "author", "created_at")
    search_fields = ("body", "customer__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "customer", "uploaded_by", "size", "created_at")
    search_fields = ("original_filename", "customer__name")
    readonly_fields = ("created_at", "updated_at", "size")
```

---

### 2 — Serializers

**File: `backend/apps/customers/serializers.py`** — extend imports and append two serializers:

```python
from .models import Attachment, ContactDetail, Customer, Note
```

```python
class NoteSerializer(BaseModelSerializer):
    # `author` itself is read-only — never client-supplied, always set from
    # `request.user` in `NoteViewSet.perform_create` (Story 21
    # `## Product rules`). `author_name` mirrors `TicketSerializer
    # .category_name`'s verified-safe `allow_null=True` pattern (Story 18):
    # `source="author.get_full_name"` returns `None`, not an error, when
    # `author` is `None` (a deleted user).
    author_name = serializers.CharField(
        source="author.get_full_name", read_only=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Note
        fields = ("id", "customer", "author", "author_name", "body", "created_at", "updated_at")
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("author",)

    def update(self, instance, validated_data):
        """Reassigning a note to a different customer is not supported —
        mirrors `ContactDetailSerializer.update` verbatim (Story 11)."""
        validated_data.pop("customer", None)
        return super().update(instance, validated_data)


class AttachmentSerializer(BaseModelSerializer):
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.get_full_name", read_only=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Attachment
        fields = (
            "id",
            "customer",
            "uploaded_by",
            "uploaded_by_name",
            "file",
            "original_filename",
            "size",
            "created_at",
            "updated_at",
        )
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "uploaded_by",
            "original_filename",
            "size",
        )
        # write_only: without this, DRF's FileField.to_representation calls
        # `.url` (UPLOADED_FILES_USE_URL defaults to True), which raises —
        # no MEDIA_URL is configured. Verified, see Story 21
        # `## Prerequisites`.
        extra_kwargs = {"file": {"write_only": True}}
```

---

### 3 — Views and routing

**File: `backend/apps/customers/views.py`** — extend imports and append two viewsets:

```python
from django.http import FileResponse
from rest_framework.parsers import MultiPartParser

from .models import Attachment, ContactDetail, Customer, Note
from .serializers import AttachmentSerializer, ContactDetailSerializer, CustomerSerializer, NoteSerializer
```

```python
class NoteViewSet(BaseModelViewSet):
    """Note CRUD for one customer. Reuses `customers.*` — a note is part of
    the customer record, the same reasoning `ContactDetailViewSet` already
    established (Story 11 `## Product rules`).
    """

    queryset = Note.objects.select_related("author").all()
    serializer_class = NoteSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if not customer_id:
            raise ValidationError({"customer": [_("This query parameter is required.")]})
        try:
            customer_id = int(customer_id)
        except ValueError:
            raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
        return queryset.filter(customer_id=customer_id)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class AttachmentViewSet(BaseModelViewSet):
    """Attachment create/list/retrieve/destroy/download for one customer.
    Reuses `customers.*`, same reasoning as `NoteViewSet`. No `update`/
    `partial_update` — see Story 21 `## Prerequisites`.
    """

    queryset = Attachment.objects.select_related("uploaded_by").all()
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser]
    # Narrows Django's own View.http_method_names — verified this makes
    # PUT/PATCH a clean 405 before any handler or permission_map lookup
    # runs (rest_framework/views.py:517). See Story 21 `## Prerequisites`.
    http_method_names = ["get", "post", "delete", "head", "options"]

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
        "download": Permissions.CUSTOMERS_VIEW,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if not customer_id:
            raise ValidationError({"customer": [_("This query parameter is required.")]})
        try:
            customer_id = int(customer_id)
        except ValueError:
            raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
        return queryset.filter(customer_id=customer_id)

    def perform_create(self, serializer):
        file_obj = serializer.validated_data["file"]
        serializer.save(
            uploaded_by=self.request.user,
            original_filename=file_obj.name,
            size=file_obj.size,
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        """Streams the file back with its original name. Bypasses
        `EnvelopeJSONRenderer` entirely — verified safe, see Story 21
        `## Prerequisites`.
        """
        attachment = self.get_object()
        return FileResponse(
            attachment.file.open("rb"),
            as_attachment=True,
            filename=attachment.original_filename,
        )
```

`CustomerViewSet` (unchanged) and its imports need `action`/`permissions_for` already present from Story 20 — extend the existing `from rest_framework.decorators import action` line's usage, not a new import.

**File: `backend/apps/customers/urls.py`** — replace entirely:

```python
from rest_framework.routers import DefaultRouter

from .views import AttachmentViewSet, ContactDetailViewSet, CustomerViewSet, NoteViewSet

app_name = "customers"

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("contact-details", ContactDetailViewSet, basename="contact-detail")
router.register("notes", NoteViewSet, basename="note")
router.register("attachments", AttachmentViewSet, basename="attachment")

urlpatterns = router.urls
```

Endpoints: `GET/POST /api/notes/`, `GET/PATCH/DELETE /api/notes/<id>/`, `GET/POST /api/attachments/`, `GET/DELETE /api/attachments/<id>/`, `GET /api/attachments/<id>/download/`.

---

## Documentation Tasks

### 4 — Environment variables

**File: `backend/.env.example`** — append after the `# --- SMS (COMM-4) ---` block:

```
# --- Media (CUST-4) ---
MEDIA_ROOT=
```

**File: `README.md`** — append one row to the `### Backend` table (after `SMS_WEBHOOK_URL`, line 492):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MEDIA_ROOT` | no | `<repo>/backend/media` | Filesystem path where uploaded `Attachment` files are stored. No `MEDIA_URL` — files are served only through the permission-gated `AttachmentViewSet.download` action. |

### 5 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 20's paragraph):

> **A file is served through a permission-gated action, never through Django's own static/media URL mechanism.** `AttachmentViewSet.download` (Story 21, `CUST-4`) returns a `FileResponse`, which bypasses `EnvelopeJSONRenderer` entirely because it is not a `rest_framework.response.Response` — verified against `APIView.finalize_response`, which only attaches the envelope machinery to that one class. No `MEDIA_URL` is configured at all, because Django's own media serving carries no permission check. **A `FileField` is marked `write_only` on its serializer** so DRF never calls `.url` (which would raise without `MEDIA_URL`) — the read side exposes `original_filename`/`size` instead. **A `FormData` upload through the project's shared `httpClient` needs an explicit `Content-Type: undefined` override**, because the instance's default JSON header would otherwise make axios `JSON.stringify` the `FormData` instead of sending it as multipart — verified against the installed axios's `transformRequest`. **An authenticated file download cannot be a plain `<a href>` link** (a browser navigation carries no `Authorization` header); fetch it as a blob through the same authenticated `httpClient` instead, then trigger the save via a temporary `URL.createObjectURL` link. **A verb a resource does not support is removed from `http_method_names`**, not merely left out of `permission_map` — an unmapped action is authenticated-only, not forbidden, so narrowing the allowed HTTP methods is the only way to make an unsupported verb a clean `405`.

---

## Frontend Tasks

### 6 — The `FileField` shared primitive

**Create file: `frontend/src/shared/ui/form/FileField.tsx`**

```tsx
import type { FieldValues } from 'react-hook-form'

import { Input } from '@/shared/ui/primitives/input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'

import type { FieldProps } from './types'

type FileFieldProps<TFieldValues extends FieldValues> = FieldProps<TFieldValues> & {
  accept?: string
}

/**
 * A real DOM `<input type="file">` — but unlike `TextField`, `field.value`
 * must NOT be spread onto it: browsers reject any scripted `value` on a
 * file input other than `''` (a security restriction, not a framework
 * quirk). `onChange` is wired explicitly to capture the selected `File`
 * into RHF state; the input stays uncontrolled for `value`. `Input`
 * already ships `file:*` Tailwind classes — no new primitive needed. See
 * CONVENTIONS.md §20.
 */
export function FileField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  accept,
}: FileFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: { value: _value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept={accept}
              disabled={disabled}
              onChange={(event) => onChange(event.target.files?.[0] ?? null)}
              {...field}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

**File: `frontend/src/shared/ui/form/index.ts`** — add the export:

```ts
export { FileField } from './FileField'
```

---

### 7 — Note type and API layer

**Create file: `frontend/src/features/customers/types/note.ts`**

```ts
/** Mirrors `apps.customers.serializers.NoteSerializer` verbatim. */
export type Note = {
  id: number
  customer: number
  author: number | null
  author_name: string | null
  body: string
  created_at: string
  updated_at: string
}

export type NoteInput = { customer: number; body: string }
export type NoteUpdateInput = Pick<NoteInput, 'body'>
```

**Create file: `frontend/src/features/customers/api/getNotes.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Note } from '../types/note'

// page_size: 100 — a customer's notes are a short inline list, the same
// simplification `getContactDetails.ts` accepted.
export function getNotes(customerId: number): Promise<Page<Note>> {
  return api.getPage<Note>('/notes/', { params: { customer: customerId, page_size: 100 } })
}
```

**Create file: `frontend/src/features/customers/api/createNote.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Note, NoteInput } from '../types/note'

export function createNote(input: NoteInput): Promise<Note> {
  return api.post<Note>('/notes/', input)
}
```

**Create file: `frontend/src/features/customers/api/updateNote.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Note, NoteUpdateInput } from '../types/note'

export function updateNote(id: number, input: NoteUpdateInput): Promise<Note> {
  return api.patch<Note>(`/notes/${id}/`, input)
}
```

**Create file: `frontend/src/features/customers/api/deleteNote.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function deleteNote(id: number): Promise<void> {
  return api.delete(`/notes/${id}/`)
}
```

**Create file: `frontend/src/features/customers/api/useNotes.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getNotes } from './getNotes'

export function useNotes(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('notes', customerId),
    queryFn: () => getNotes(customerId),
  })
}
```

**Create file: `frontend/src/features/customers/api/useNoteMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createNote } from './createNote'
import { customerKeys } from './customerKeys'
import { deleteNote } from './deleteNote'
import { updateNote } from './updateNote'
import type { NoteInput, NoteUpdateInput } from '../types/note'

/** Scoped invalidation, not the whole-feature prefix — a note write for one
 * customer never affects another's, same reasoning as
 * `useContactDetailMutations.ts` (Story 11 `## Product rules`). */
function useInvalidateNotes(customerId: number) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: customerKeys.resource('notes', customerId) })
}

export function useCreateNote(customerId: number) {
  const invalidate = useInvalidateNotes(customerId)
  return useMutation({
    mutationFn: (input: NoteInput) => createNote(input),
    onSuccess: invalidate,
  })
}

export function useUpdateNote(customerId: number, id: number) {
  const invalidate = useInvalidateNotes(customerId)
  return useMutation({
    mutationFn: (input: NoteUpdateInput) => updateNote(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteNote(customerId: number) {
  const invalidate = useInvalidateNotes(customerId)
  return useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: invalidate,
  })
}
```

---

### 8 — Attachment type and API layer

**Create file: `frontend/src/features/customers/types/attachment.ts`**

```ts
/** Mirrors `apps.customers.serializers.AttachmentSerializer` verbatim.
 * `file` is write-only on the backend and never appears in a response. */
export type Attachment = {
  id: number
  customer: number
  uploaded_by: number | null
  uploaded_by_name: string | null
  original_filename: string
  size: number
  created_at: string
  updated_at: string
}

export type UploadAttachmentInput = { customer: number; file: File }
```

**Create file: `frontend/src/features/customers/api/getAttachments.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Attachment } from '../types/attachment'

export function getAttachments(customerId: number): Promise<Page<Attachment>> {
  return api.getPage<Attachment>('/attachments/', {
    params: { customer: customerId, page_size: 100 },
  })
}
```

**Create file: `frontend/src/features/customers/api/uploadAttachment.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Attachment, UploadAttachmentInput } from '../types/attachment'

/**
 * `Content-Type: undefined` overrides `httpClient`'s default
 * `application/json` header for this one request — without it, axios
 * would `JSON.stringify` the `FormData` instead of sending it as
 * `multipart/form-data`, silently corrupting the upload. Verified against
 * the installed axios; see Story 21 `## Prerequisites`.
 */
export function uploadAttachment(input: UploadAttachmentInput): Promise<Attachment> {
  const formData = new FormData()
  formData.append('customer', String(input.customer))
  formData.append('file', input.file)
  return api.post<Attachment>('/attachments/', formData, {
    headers: { 'Content-Type': undefined },
  })
}
```

**Create file: `frontend/src/features/customers/api/deleteAttachment.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function deleteAttachment(id: number): Promise<void> {
  return api.delete(`/attachments/${id}/`)
}
```

**Create file: `frontend/src/features/customers/api/downloadAttachment.ts`**

```ts
import { httpClient } from '@/shared/lib/api/client'

/**
 * Cannot be a plain `<a href>` link — the API is Bearer-token
 * authenticated, and a browser navigation carries no `Authorization`
 * header. Fetches the file as a blob through the same authenticated
 * `httpClient` instance instead (not `api.get()` — the response body is a
 * raw file stream, not the JSON envelope `unwrap()` expects), then
 * triggers the browser's own save flow via a temporary object-URL link.
 * See Story 21 `## Prerequisites`.
 */
export async function downloadAttachment(id: number, filename: string): Promise<void> {
  const response = await httpClient.get(`/attachments/${id}/download/`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

**Create file: `frontend/src/features/customers/api/useAttachments.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getAttachments } from './getAttachments'

export function useAttachments(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('attachments', customerId),
    queryFn: () => getAttachments(customerId),
  })
}
```

**Create file: `frontend/src/features/customers/api/useAttachmentMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { deleteAttachment } from './deleteAttachment'
import { uploadAttachment } from './uploadAttachment'
import type { UploadAttachmentInput } from '../types/attachment'

function useInvalidateAttachments(customerId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: customerKeys.resource('attachments', customerId) })
}

export function useUploadAttachment(customerId: number) {
  const invalidate = useInvalidateAttachments(customerId)
  return useMutation({
    mutationFn: (input: UploadAttachmentInput) => uploadAttachment(input),
    onSuccess: invalidate,
  })
}

export function useDeleteAttachment(customerId: number) {
  const invalidate = useInvalidateAttachments(customerId)
  return useMutation({
    mutationFn: (id: number) => deleteAttachment(id),
    onSuccess: invalidate,
  })
}
```

---

### 9 — Notes section

**Create file: `frontend/src/features/customers/components/NotesSection.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { TextareaField, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateNote, useDeleteNote, useUpdateNote } from '../api/useNoteMutations'
import { useNotes } from '../api/useNotes'
import type { Note } from '../types/note'

const noteSchema = z.object({ body: requiredString(5000) })
type NoteFormValues = z.output<typeof noteSchema>

export function NotesSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useNotes(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('notes.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('notes.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((note) => (
                <NoteRow key={note.id} customerId={customerId} note={note} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="customers.manage">
          <NoteAddForm customerId={customerId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function NoteRow({ customerId, note }: { customerId: number; note: Note }) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteNote(customerId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('notes.delete.title'),
      description: t('notes.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(note.id)
  }

  if (isEditing) {
    return (
      <NoteEditForm customerId={customerId} note={note} onDone={() => setIsEditing(false)} />
    )
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {note.author_name ?? t('notes.unknownAuthor')} · {dateTime(note.created_at)}
        </span>
        <Can permission="customers.manage">
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              {t('notes.actions.edit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {t('notes.actions.remove')}
            </Button>
          </div>
        </Can>
      </div>
      <p className="whitespace-pre-wrap">{note.body}</p>
    </li>
  )
}

function NoteAddForm({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: '' } })
  const mutation = useCreateNote(customerId)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(
      { customer: customerId, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('notes.created') })
          form.reset({ body: '' })
          setFormErrors([])
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <TextareaField control={form.control} name="body" label={t('notes.fields.body')} />
        {formErrors.length > 0 ? (
          <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t('notes.actions.add')}
        </Button>
      </form>
    </Form>
  )
}

function NoteEditForm({
  customerId,
  note,
  onDone,
}: {
  customerId: number
  note: Note
  onDone: () => void
}) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: noteSchema, defaultValues: { body: note.body } })
  const mutation = useUpdateNote(customerId, note.id)

  function onSubmit(values: NoteFormValues) {
    mutation.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('notes.updated') })
        onDone()
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
      },
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <TextareaField control={form.control} name="body" label={t('notes.fields.body')} />
          {formErrors.length > 0 ? (
            <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {t('notes.actions.save')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('notes.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
```

---

### 10 — Attachments section

**Create file: `frontend/src/features/customers/components/AttachmentsSection.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FileField, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { downloadAttachment } from '../api/downloadAttachment'
import { useDeleteAttachment, useUploadAttachment } from '../api/useAttachmentMutations'
import { useAttachments } from '../api/useAttachments'
import type { Attachment } from '../types/attachment'

// No `.max()`/`.mime()` — no size or type restriction, an accepted scope
// gap (see Story 21 `## Edge Cases`). A bare `z.file()` already gets a
// translated "required" message via the shared error map's `isBlank`
// fallback.
const attachmentSchema = z.object({ file: z.file() })
type AttachmentFormValues = z.output<typeof attachmentSchema>

// No natural "empty" File value — RHF's DefaultValues<T> wants the
// schema's real output type, but the field starts genuinely unset until
// the user picks a file. A documented, deliberate cast at a real
// type-system seam, the same class of friction TicketFormPage's own
// string-to-number conversions accept, just with no valid placeholder
// value at all here.
const EMPTY_DEFAULTS = { file: null } as unknown as AttachmentFormValues

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentsSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useAttachments(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('attachments.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('attachments.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((attachment) => (
                <AttachmentRow
                  key={attachment.id}
                  customerId={customerId}
                  attachment={attachment}
                />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="customers.manage">
          <AttachmentUploadForm customerId={customerId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function AttachmentRow({
  customerId,
  attachment,
}: {
  customerId: number
  attachment: Attachment
}) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const deleteMutation = useDeleteAttachment(customerId)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadAttachment(attachment.id, attachment.original_filename)
    } catch {
      toast({ tone: 'error', message: t('attachments.downloadFailed') })
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('attachments.delete.title'),
      description: t('attachments.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(attachment.id)
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex flex-col">
        {/* Latin-script or mixed-script filename inside an Arabic document
            — the same LTR-wrap call `ContactDetailRow` makes for an email
            or phone value (CONVENTIONS.md §18). */}
        <span dir="ltr">{attachment.original_filename}</span>
        <span className="text-sm text-muted-foreground">
          {formatSize(attachment.size)} · {attachment.uploaded_by_name ?? t('notes.unknownAuthor')}{' '}
          · {dateTime(attachment.created_at)}
        </span>
      </div>
      <Can permission="customers.view">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {t('attachments.actions.download')}
          </Button>
          <Can permission="customers.manage">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {t('attachments.actions.remove')}
            </Button>
          </Can>
        </div>
      </Can>
    </li>
  )
}

function AttachmentUploadForm({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const form = useAppForm({ schema: attachmentSchema, defaultValues: EMPTY_DEFAULTS })
  const mutation = useUploadAttachment(customerId)

  function onSubmit(values: AttachmentFormValues) {
    mutation.mutate(
      { customer: customerId, file: values.file },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('attachments.uploaded') })
          form.reset(EMPTY_DEFAULTS)
        },
        // A non-validation failure is already toasted by the shared
        // mutation error handler — CONVENTIONS.md §21.
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <FileField control={form.control} name="file" label={t('attachments.fields.file')} />
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t('attachments.actions.upload')}
        </Button>
      </form>
    </Form>
  )
}
```

---

### 11 — Wire both sections into the profile

**File: `frontend/src/features/customers/components/CustomerProfilePage.tsx`** — two more imports, and two more lines between `ContactDetailsSection` and `InteractionTimelineSection`:

```tsx
import { AttachmentsSection } from './AttachmentsSection'
import { NotesSection } from './NotesSection'
```

```tsx
              <ContactDetailsSection customerId={customer.id} />
              <NotesSection customerId={customer.id} />
              <AttachmentsSection customerId={customer.id} />
              <InteractionTimelineSection customerId={customer.id} />
```

---

### 12 — Locale keys

**File: `frontend/src/features/customers/locales/en.json`** — add `notes` and `attachments` blocks between `contacts` and `timeline`:

```json
  "notes": {
    "title": "Notes",
    "empty": "No notes yet.",
    "unknownAuthor": "Unknown",
    "fields": {
      "body": "Note"
    },
    "actions": {
      "add": "Add note",
      "edit": "Edit",
      "remove": "Remove",
      "save": "Save",
      "cancel": "Cancel"
    },
    "delete": {
      "title": "Remove this note?",
      "description": "This permanently removes the note. This cannot be undone."
    },
    "created": "Note added.",
    "updated": "Note updated."
  },
  "attachments": {
    "title": "Attachments",
    "empty": "No attachments yet.",
    "downloadFailed": "Could not download this file.",
    "fields": {
      "file": "File"
    },
    "actions": {
      "upload": "Upload",
      "download": "Download",
      "remove": "Remove"
    },
    "delete": {
      "title": "Remove this attachment?",
      "description": "This permanently removes the file. This cannot be undone."
    },
    "uploaded": "File uploaded."
  },
```

**File: `frontend/src/features/customers/locales/ar.json`** — the identical key set, translated:

```json
  "notes": {
    "title": "الملاحظات",
    "empty": "لا توجد ملاحظات بعد.",
    "unknownAuthor": "غير معروف",
    "fields": {
      "body": "ملاحظة"
    },
    "actions": {
      "add": "إضافة ملاحظة",
      "edit": "تعديل",
      "remove": "إزالة",
      "save": "حفظ",
      "cancel": "إلغاء"
    },
    "delete": {
      "title": "هل تريد إزالة هذه الملاحظة؟",
      "description": "سيؤدي هذا إلى إزالة الملاحظة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
    },
    "created": "تمت إضافة الملاحظة.",
    "updated": "تم تحديث الملاحظة."
  },
  "attachments": {
    "title": "المرفقات",
    "empty": "لا توجد مرفقات بعد.",
    "downloadFailed": "تعذّر تنزيل هذا الملف.",
    "fields": {
      "file": "الملف"
    },
    "actions": {
      "upload": "رفع",
      "download": "تنزيل",
      "remove": "إزالة"
    },
    "delete": {
      "title": "هل تريد إزالة هذا المرفق؟",
      "description": "سيؤدي هذا إلى إزالة الملف نهائيًا. لا يمكن التراجع عن هذا الإجراء."
    },
    "uploaded": "تم رفع الملف."
  },
```

---

## Edge Cases & Failure Modes

- **No file size or type restriction, anywhere.** `z.file()` has no `.max()`/`.mime()`; the API enforces nothing beyond Django's own request-handling defaults (which do not cap multipart file size — verified: `DATA_UPLOAD_MAX_MEMORY_SIZE` only governs non-file form fields, `django/http/multipartparser.py`'s `FIELD`-type branch, not the `FILE`-type branch a file part takes). Accepted for this story's scope, the same "document the gap, don't preemptively solve it" call Story 19 made for rate limiting.
- **A missing file on disk (deleted outside the app) surfaces as an unhandled `500` on download**, not a clean `404`. `attachment.file.open("rb")` raises `FileNotFoundError`, which `_to_drf_exception` does not translate (verified, see `## Prerequisites`). Not expected in normal operation; accepted rather than adding a `try/except` for a scenario that requires manual filesystem tampering to reach.
- **Uploading through anything other than `uploadAttachment.ts`'s exact `Content-Type: undefined` override silently corrupts the file** — the request would still return `201`, but the stored bytes would be a JSON-stringified `FormData` dump, not the file's real content. This is the single most likely silent bug in this story; `## Verification Steps` confirms a downloaded file matches the uploaded one byte-for-byte.
- **Deleting a customer cascades to their notes and attachments (files included in the DB row, but not on disk).** `on_delete=CASCADE` removes the `Attachment` rows, but Django does **not** delete the underlying file from storage when a model instance is deleted (well-documented Django behaviour — `FileField` deletion is opt-in via a signal, not automatic). Orphaned files accumulate on disk after a customer delete. Accepted; a future story could add a `post_delete` signal if this becomes a real cleanup concern.
- **`author`/`uploaded_by` becomes `None` (and `author_name`/`uploaded_by_name` becomes `null`) if the user who created it is later deleted.** The note/attachment itself survives (`SET_NULL`), matching `Ticket.category`'s own precedent (Story 18). The UI shows `notes.unknownAuthor` (`"Unknown"`) rather than a blank space.
- **The download button's `disabled={downloading}` state prevents a double-click from firing two concurrent downloads**, but a failed download (e.g. a `404` for an attachment deleted by someone else in the meantime) surfaces only as a generic toast, not the specific reason — the same rough edge Story 19 accepted for `web_form`'s "category deleted mid-flow" case.
- **A note's or attachment's `customer` field cannot be changed via the API** — `NoteSerializer.update()` pops it (mirrors `ContactDetailSerializer`), and `AttachmentViewSet` supports no update verb at all.
- **Arabic note bodies round-trip correctly with no `dir` override** — free-form prose, the same call `TicketConversation.tsx`/`MessageRow` (Story 20) make. Filenames get the opposite treatment (`dir="ltr"`), matching `ContactDetailRow`'s Latin-script-value precedent, since a filename (even one containing Arabic characters) reads as a single token, not prose.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** after task 1's migration is committed.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: note CRUD across permission states; attachment upload/list/download/delete across permission states; `PUT`/`PATCH` on an attachment returning `405`; a downloaded file's bytes matching the uploaded file exactly; the required-`customer`-query-param guard on both list endpoints — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new `FileField` primitive and both sections.
6. An `en`/`ar` key-set comparison for `features/customers/locales/` (a throwaway script, not a checked-in test) — confirms both files declare the same keys after task 12.

---

## Migration / Rollback

**One migration**, generated by task 1: `CreateModel` × 2 (`Note`, `Attachment`). Depends on `0003_contactdetail`.

**Rollback of the code:** revert the commits, then `python manage.py migrate customers 0003` to unapply the new migration before removing it, if reverting only this story's migration. Delete `MEDIA_ROOT`'s contents manually if reverting a deployment that already has uploaded files — the migration rollback does not touch the filesystem.

**Half-applied states to avoid:**

- **`AttachmentSerializer.file` shipped without `write_only`.** DRF's `FileField.to_representation` calls `.url` by default, which raises immediately on the very first `list`/`retrieve` (no `MEDIA_URL` configured) — a `500` on every attachment read, not a silent gap. Verify this explicitly; see `## Prerequisites`.
- **`uploadAttachment.ts` shipped without the `Content-Type: undefined` override.** No error at all — the request succeeds with a `201`, but the file is corrupted. This is the single hardest half-applied state to catch by inspection alone; `## Verification Steps` step 4 downloads what was just uploaded and diffs it.
- **`AttachmentViewSet.http_method_names` left at the `ModelViewSet` default.** `PUT`/`PATCH` would not error, but would also do nothing useful (no `update()` support was written) — actually reachable and probably a `500` from a missing serializer method path, not a clean `405`. Verify the narrowed list is in place.
- **`Note.author`/`Attachment.uploaded_by` added without `null=True, blank=True`.** `SET_NULL` requires a nullable field — `makemigrations` would fail the same way Story 18's `## Migration / Rollback` already documented for `Ticket.category`.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations customers` produces one file with two `CreateModel` operations; `python manage.py migrate`; `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Note CRUD, permission-gated.** With an agent token: `POST /api/notes/` `{"customer": <id>, "body": "First note"}` → `201`, `author` is the agent's own user id, `author_name` is their name. `GET /api/notes/?customer=<id>` → `200`, includes it. `PATCH /api/notes/<id>/` `{"body": "Edited"}` → `200`. `DELETE /api/notes/<id>/` → `204`. With no token → `401` on all four. `GET /api/notes/` with **no** `customer` query param → `400` naming `customer`.
5. **Attachment upload, byte-for-byte round trip.** From `curl`, upload a small known text file: `curl -F "customer=<id>" -F "file=@test.txt" -H "Authorization: Bearer <token>" http://localhost:8000/api/attachments/` → `201`, response includes `original_filename: "test.txt"`, a `size` matching the file's real byte count, and **no** `file` key in the response body (write-only, confirmed). `GET /api/attachments/<id>/download/` with the same token → `200`, `Content-Disposition: attachment; filename="test.txt"`, and the response body byte-for-byte identical to the original `test.txt` (`diff` the downloaded bytes against the source file).
6. **`PUT`/`PATCH` on an attachment is a clean `405`.** `PATCH /api/attachments/<id>/` with any body → `405`, not a `500` and not silently accepted.
7. **Permission gating on attachments.** No token → `401` on list/create/download/delete. A `customers.view`-only user (reuse the throwaway-role technique from Story 20's own verification) → `200` on list/retrieve/download, `403` on create/delete. The normal agent token → all succeed.
8. **The required `customer` query param guards both list endpoints.** `GET /api/attachments/` with no `customer` param → `400` naming `customer`, same shape as step 4's note check.
9. **Deleting a customer cascades notes and attachments, not just tickets.** Create a fresh customer with one note and one attachment, then `DELETE /api/customers/<id>/` → `204`. `GET /api/notes/?customer=<id>` still returns `200` with `[]` (the id is just a filter value, not a lookup) — the real proof is that `GET /api/notes/<note id>/` and `GET /api/attachments/<attachment id>/` (the specific rows created above) both now return `404`.
10. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as an agent:
    - Open a customer profile — "Notes" and "Attachments" cards render between "Contact channels" and "Interaction history."
    - Add a note, edit it, remove it — each action's toast fires and the list updates without a page reload.
    - Upload a small file — it appears in the list with a human-readable size (e.g. "12.3 KB") and the uploader's name.
    - Click "Download" — the browser's own save dialog/download appears with the correct original filename; open the downloaded file and confirm its contents match what was uploaded.
    - Remove the attachment — it disappears from the list.
    - Switch to Arabic — every label translates, the note body and filename both render with the correct direction (prose RTL-flowed, filename forced LTR).
11. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
12. **Clean up** every record created for steps 4-9 (attachments and notes first, then customers), and delete any files left under `MEDIA_ROOT` by the verification uploads.

---

## Done Criteria

- [ ] `Note` — `customer` (`CASCADE`), `author` (`SET_NULL`, nullable), `body`; `Meta.ordering = ("-created_at",)`.
- [ ] `Attachment` — `customer` (`CASCADE`), `uploaded_by` (`SET_NULL`, nullable), `file` (`FileField`, `upload_to=attachment_upload_path`), `original_filename`, `size`; same ordering.
- [ ] One migration: two `CreateModel` operations, depends on `0003_contactdetail`. **No new permission-grant migration.**
- [ ] `MEDIA_ROOT` added to `base.py`, `ENV`-driven, default `BASE_DIR / "media"` (already gitignored). **No `MEDIA_URL`.**
- [ ] `NoteAdmin`/`AttachmentAdmin` registered.
- [ ] `NoteSerializer` (`author` read-only, `author_name` via verified-safe dotted `source`, `update()` blocks `customer` reassignment); `AttachmentSerializer` (`file` `write_only`, `uploaded_by`/`original_filename`/`size` all read-only).
- [ ] `NoteViewSet` — full CRUD, `permission_map` reuses `CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE`, required `customer` query param on list, `perform_create` sets `author`.
- [ ] `AttachmentViewSet` — create/list/retrieve/destroy/`download`, `parser_classes = [MultiPartParser]`, `http_method_names` excludes `put`/`patch`, `perform_create` derives `original_filename`/`size` from the uploaded file, `download` returns a `FileResponse`.
- [ ] `apps/customers/urls.py` — `notes`/`attachments` registered on the same `DefaultRouter`.
- [ ] `shared/ui/form/FileField.tsx` — new shared primitive, exported from `shared/ui/form/index.ts`, `field.value` never spread onto the native input.
- [ ] `features/customers/types/note.ts`, `types/attachment.ts`, full `api/` layer for both (get/create/update-where-applicable/delete/mutations), `uploadAttachment.ts` with the verified `Content-Type: undefined` override, `downloadAttachment.ts`'s blob-fetch-then-click flow.
- [ ] `NotesSection.tsx` (add/edit/remove, mirrors `ContactDetailsSection`) and `AttachmentsSection.tsx` (upload/list/download/remove) — both `Card` + `QueryBoundary` + `<ul>`.
- [ ] `CustomerProfilePage.tsx` — both sections wired in between `ContactDetailsSection` and `InteractionTimelineSection`.
- [ ] `en.json`/`ar.json` — `notes`/`attachments` blocks, identical key sets in both languages.
- [ ] `.env.example`/`README.md` — `MEDIA_ROOT` documented in the same change.
- [ ] `CONVENTIONS.md` § 23 gains the file-serving / write-only-FileField / FormData-Content-Type / authenticated-download / http_method_names paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: note CRUD across permission states (Step 4); a byte-for-byte upload/download round trip with `file` absent from the response (Step 5); `405` on attachment `PATCH` (Step 6); attachment permission gating (Step 7); the required-`customer`-param guard on both list endpoints (Steps 4, 8); customer-delete cascading to notes and attachments (Step 9).
- [ ] Both languages walk through cleanly in the browser, including a real upload/download round trip (Step 10).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and file created during verification is cleaned up (Step 12).
- [ ] `.squad/plans/customer-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** This is the **last** story in `customer-management` — EPIC 3 is now fully planned.
