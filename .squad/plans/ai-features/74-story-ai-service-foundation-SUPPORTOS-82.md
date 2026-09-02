# Story 74 — AI Service Foundation (Story: SUPPORTOS-82)

## Prerequisites

- **None on other stories — this is the first story in `ai-features` (`EPIC 13`).** `apps.ai` is already registered in `INSTALLED_APPS` (`backend/config/settings/base.py` line 68, in `LOCAL_APPS`) but is a bare `startapp` scaffold: `apps/ai/models.py` and `apps/ai/views.py` are each one comment line, `apps/ai/admin.py` is one comment line, and `apps/ai/migrations/` has only `__init__.py`. This story is the first real code in the app.
- **The intake file (`.squad/stories/ai-features/SUPPORTOS-82/intake.md`) carries the wrong description** — its "Summary endpoint + UI action" text is `AI-1`'s (Ticket Summaries, `SUPPORTOS-83`) task, not `AI-0`'s. The authoritative text is `SupportOs backlog.MD` lines 815-823 (`EPIC 13 — AI Features`, `STORY (AI-0) — AI Service Foundation`):

  > **Task: AI provider client + prompt/util layer** 🔑 (reused by all AI stories) — Implement one server-side AI client (keys via `ENV`), shared prompt-building utilities, and KB grounding via KB-3 search. Constraints: single AI integration point; features call it, don't re-integrate. Outcome: reusable AI foundation.

  This story plans against the backlog text, confirmed with the user. **No summarize endpoint, no ticket-detail UI action, and no other product-visible surface belongs to this story** — those are `AI-1` (`SUPPORTOS-83`), planned separately.
- **KB-3 (Knowledge Base Search, Story 41, `SUPPORTOS-54`) is complete and is what this story's KB grounding calls.** `apps/knowledge_base/search.py::search_knowledge_base(query, *, limit=20, include_drafts=False)` already exists for exactly this purpose — [41-story-knowledge-base-search-SUPPORTOS-54.md](../knowledge-base/41-story-knowledge-base-search-SUPPORTOS-54.md)'s own `## Story Goal` names `AI-0`'s grounding call as the reason the function is a plain, HTTP-independent function in the first place. This story is that named caller.
- **This story adds no Django model, no migration, no permission constant, no API endpoint, and no frontend change.** Its entire surface is `requirements.txt`, three new files in `apps/ai/`, `config/settings/base.py`, `.env.example`, `README.md`, and `CONVENTIONS.md` — the same "pure infrastructure" shape [27-story-background-jobs-foundation-SUPPORTOS-49.md](../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md) (`SLA-0`) established for a foundation story with no domain model yet.
- **Verified live, this session:** `pip index versions anthropic` shows `1.3.0` as the latest release (the `anthropic` package is not yet installed in `backend/.venv`); `python manage.py test` reports **54** passing, the current baseline this story must not change.

---

## Story Goal

Ship the one server-side integration point every later `AI-*` story (`AI-1` Ticket Summaries, `AI-2` Suggested Replies, `AI-3` Automatic Categorization, `AI-4` Suggested Solutions, `AI-5` AI Chatbot) calls instead of importing the `anthropic` SDK directly:

1. **`apps/ai/client.py`** — a single configured Anthropic client and one `generate_completion(...)` function that every later story's endpoint calls. Credentials come from `ENV` (`ANTHROPIC_API_KEY`), read the same explicit way every other third-party integration in this project reads its credentials (`WHATSAPP_*`/`SMS_*`/`EMAIL_*` in `config/settings/base.py`) — never the SDK's own auto-discovery. Any SDK-level failure (unconfigured key, provider error, network error) is normalised into one `AIServiceError`, so a calling view never needs to import or catch an `anthropic.*` exception class.
2. **`apps/ai/prompts.py`** — shared prompt-building utilities, including KB grounding via `apps.knowledge_base.search.search_knowledge_base` (`KB-3`). This is the "shared prompt-building utilities... and KB grounding via KB-3 search" half of the intake's one task.
3. **Settings/docs**: `ANTHROPIC_API_KEY` and `AI_MODEL` in `config/settings/base.py`, `.env.example`, and `README.md`'s environment-variable table; a new `CONVENTIONS.md` § naming this as the one AI integration point, mirroring § 24's role for Celery.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/ai/client.py` (`get_client`, `generate_completion`, `AIServiceError`) | "one server-side AI client (keys via ENV)... single AI integration point" (backlog, `AI-0`). |
| `apps/ai/prompts.py` (`ground_with_knowledge_base`, `format_kb_context`, `build_grounded_system_prompt`) | "shared prompt-building utilities, and KB grounding via KB-3 search" (backlog, `AI-0`). |
| `ANTHROPIC_API_KEY`, `AI_MODEL` in `base.py`/`.env.example`/`README.md` | "keys via ENV" (backlog, `AI-0`); `AI_MODEL` lets a later story tune cost/quality per feature without a code change. |
| `CONVENTIONS.md` new section | Same reason § 24 (Celery) and § 27 (Reporting) exist — the one place a later `AI-*` story's author reads before writing a second AI integration point. |

**Not here, and why:**

- **No `/api/...` endpoint of any kind.** The intake's own task has no HTTP surface — `AI-1` is the first story that wraps `generate_completion` in a view.
- **No Django model, no migration.** `apps/ai/models.py` stays the one-line stub; nothing in this story's scope needs persistence. A future story that needs to store, e.g., a generated summary alongside its ticket adds that model itself, in its own app-ownership area.
- **No permission constant.** `apps/core/permissions.py` is untouched — permissions gate endpoints, and this story ships none. `AI-1`'s endpoint is what adds `Permissions.AI_USE` (or equivalent) alongside its view, per `CONVENTIONS.md` § 23.
- **No streaming, no multi-turn conversation state, no Celery task.** `generate_completion` is a single-turn, synchronous call — the shape every named `AI-*` consumer (summarize, suggest-reply, categorize, suggest-solution) needs. `AI-5`'s chatbot is explicitly multi-turn and may need to extend `client.py`; that extension belongs to `AI-5`'s own story, not invented speculatively here.
- **No provider-adapter abstraction (no `ABC`, no registry) the way `apps/communications/adapters.py` has one for channels.** The backlog says "**one** server-side AI client" — communications genuinely ships four simultaneous channel implementations in its epic; this epic ships exactly one provider. Adding a swappable-provider abstraction with a single concrete implementation would be exactly the "don't design for hypothetical future requirements" case `CONVENTIONS.md` § 0 warns against.
- **No frontend change.** Nothing in this story is user-facing.

---

## Context — Read These Files First

1. `.squad/stories/ai-features/SUPPORTOS-82/intake.md` — read it, but see `## Prerequisites` above: its description text belongs to `AI-1`, not this story.
2. `SupportOs backlog.MD` lines 815-823 — the authoritative `AI-0` task text this plan implements.
3. `backend/apps/ai/{apps.py,models.py,views.py,admin.py}` — confirm all four are still bare scaffold (`apps.py` 7 lines declaring `name = "apps.ai"`; the other three are one-line stubs) before adding files alongside them.
4. `backend/config/settings/base.py` lines 55-70 (`LOCAL_APPS`, `apps.ai` at line 68) and lines 350-393 (`WHATSAPP_*`/`SMS_*` blocks) — the exact "no safe default; the code that uses it refuses to run against a blank value" pattern `ANTHROPIC_API_KEY` follows. Also lines 20-25 (`env = environ.Env()`, the no-default fail-loud pattern for `SECRET_KEY`) and line 400 (`REDIS_URL` read via `env(...)`, the plain-string-setting precedent `AI_MODEL` follows).
5. `backend/apps/communications/whatsapp_adapter.py` lines 108-114 (`WhatsAppAdapter.send`) — the literal "if not (settings.X and settings.Y): raise ValueError(...)" shape `client.py::get_client` copies for its own single credential.
6. `backend/apps/knowledge_base/search.py` (all 62 lines) — `search_knowledge_base(query, *, limit=20, include_drafts=False)` and its two per-`kind` result shapes (`faq`: `question`/`answer`/`headline`/`rank`; `article`: `title_en`/`title_ar`/`headline_en`/`headline_ar`/`status`/`rank`) — `prompts.py::format_kb_context` formats exactly these keys.
7. `backend/apps/core/exceptions.py` lines 29-51 (`envelope_exception_handler`) and 98-112 (`_internal_error_response`) — confirms that an exception DRF's own handler does not recognise (like the new `AIServiceError`) falls through to a logged, generic `500 internal_error` envelope. This story ships no view, so this is forward context for `AI-1`, not something this story wires up itself.
8. `backend/requirements.txt` (14 lines) — the exact range-pin style (`package>=X,<Y+1`) task 1's new line follows; `celery>=5.4,<6` (added by `SLA-0`) is the most recent example of the "major-version ceiling" pin shape.
9. `backend/.env.example` (64 lines) — the `# --- Section (STORY-ID) ---` header convention task 3's new `# --- AI (AI-0) ---` block follows, and the "blank until configured, in every environment" convention (`WHATSAPP_*`/`SMS_*` blocks) `ANTHROPIC_API_KEY=` follows.
10. `README.md` lines 507-552 (backend environment-variable table) — the exact `| Variable | Required | Default | Purpose |` row format, and the `*(empty — ... refuses to run until set)*` Default-column convention (`WHATSAPP_API_BASE_URL` row, line 542) task 4's `ANTHROPIC_API_KEY` row follows.
11. `backend/apps/README.md` line 83 — `ai`'s declared ownership ("AI-assisted features (suggestions, summarisation, classification)"), confirming `apps/ai/` is the correct home for this story's three new files.
12. `CONVENTIONS.md` line 1945 (end of file, end of § 27) and lines 1514-1561 (§ 24, Background jobs) — the exact tone/structure a new § 28 follows: a short "what this section covers and why it exists" intro, then the standing rules future stories must not re-derive.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **One server-side AI client; keys via ENV.** | Backlog, `AI-0`'s sole task | `apps/ai/client.py::get_client`; `ANTHROPIC_API_KEY`/`AI_MODEL` read via `env(...)` in `base.py`, never hardcoded. |
| **Single AI integration point — features call it, don't re-integrate.** | Backlog, `AI-0`'s sole task | `apps/ai/client.py::generate_completion` is the only function in the codebase that imports `anthropic`; `AIServiceError` is the only exception a caller needs to know about. |
| **Shared prompt-building utilities.** | Backlog, `AI-0`'s sole task | `apps/ai/prompts.py::build_grounded_system_prompt`. |
| **KB grounding via KB-3 search.** | Backlog, `AI-0`'s sole task | `apps/ai/prompts.py::ground_with_knowledge_base`, calling `apps.knowledge_base.search.search_knowledge_base` directly — the exact reuse `KB-3`'s own `## Story Goal` names. |
| Every environment-differing value is read from the environment, never hardcoded. | Established project rule (`base.py`'s own module docstring) | `ANTHROPIC_API_KEY`, `AI_MODEL` both via `env(...)`. |
| No new permission constant, no new model, no new migration, no frontend change. | § 0, § 23 | See `## Story Goal` "what this story does not". |

---

## Backend Tasks

### 1 — Dependency

**File: `backend/requirements.txt`** — append one line, after `django-celery-beat`:

```
anthropic>=1.0,<2
```

Matches this file's existing major-version-ceiling range-pin style (`celery>=5.4,<6`, `channels>=4.1,<5`). Verified: `1.3.0` is the current latest release; `anthropic` is not yet installed in `backend/.venv`.

---

### 2 — Settings

**File: `backend/config/settings/base.py`** — append a new settings block at the end of the file, after the `CELERY_BEAT_SCHEDULER` line:

```python

# --- AI (AI-0) ------------------------------------------------------------
# The one server-side AI integration point every AI-1..AI-5 story calls
# (SupportOs backlog.MD:822) — apps/ai/client.py, never a second
# `import anthropic` anywhere else in this codebase. Read explicitly via
# env(), the same WHATSAPP_*/SMS_* pattern (above), rather than relying on
# the anthropic SDK's own ANTHROPIC_API_KEY auto-discovery — this project
# reads every environment-differing value the same explicit way. No safe
# default: apps/ai/client.py::get_client refuses to construct a client
# against a blank key, the same "fail closed until configured" rule
# WHATSAPP_*/SMS_* already establish. See Story 74 `## Edge Cases`.
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
# Overridable per environment so a later AI-* story (or an ops change) can
# trade cost for quality without a code change — no feature hardcodes a
# model id of its own.
AI_MODEL = env("AI_MODEL", default="claude-opus-5")
```

---

### 3 — The AI client (the single integration point)

**Create file: `backend/apps/ai/exceptions.py`**

```python
class AIServiceError(Exception):
    """Raised for any AI-service failure — unconfigured credentials, a
    provider error, or a network failure. The one exception type a later
    AI-* story's view needs to catch; `apps/ai/client.py` never lets an
    `anthropic.*` exception escape past this module. See Story 74
    `## Story Goal` — "single AI integration point."

    Uncaught, this reaches `apps.core.exceptions.envelope_exception_handler`
    like any other exception DRF does not recognise, and becomes a logged,
    generic `500 internal_error` envelope (`apps/core/exceptions.py:98-112`)
    — a safe default until a calling view chooses to catch it and return a
    friendlier error.
    """
```

**Create file: `backend/apps/ai/client.py`**

```python
"""The single AI integration point — AI-0 (Story 74). Every AI-1..AI-5
story calls `generate_completion` here instead of importing `anthropic`
directly (SupportOs backlog.MD:822, "single AI integration point; features
call it, don't re-integrate.").
"""

import logging

import anthropic
from django.conf import settings

from .exceptions import AIServiceError

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    """Lazily construct the module-level Anthropic client. Reads
    `settings.ANTHROPIC_API_KEY` explicitly rather than letting the SDK's
    own env-var/`ant auth login` auto-discovery run — see `base.py`'s
    AI-0 settings block. Refuses to run against a blank key, the same
    "fail closed until configured" shape `WhatsAppAdapter.send`
    (`apps/communications/whatsapp_adapter.py:109-114`) already
    establishes for an unconfigured integration.
    """
    global _client
    if _client is None:
        if not settings.ANTHROPIC_API_KEY:
            raise AIServiceError("AI features are not configured (ANTHROPIC_API_KEY is blank).")
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def generate_completion(
    user_prompt: str,
    *,
    system: str | None = None,
    max_tokens: int = 4096,
    model: str | None = None,
) -> str:
    """Single-turn completion — the one function every AI-1..AI-5 story
    calls. `max_tokens=4096` covers a summary, a suggested reply, or a
    categorization label without truncation; a future story with a
    longer-form need (e.g. AI-5's chatbot) passes its own `max_tokens`
    rather than this default changing for everyone. `model` defaults to
    `settings.AI_MODEL` so a caller normally names no model at all; a
    story may still override per call if a specific task needs a
    different model tier.

    Raises `AIServiceError` for every failure mode (unconfigured client,
    provider error, network error, empty response) — never lets an
    `anthropic.*` exception reach the caller.
    """
    client = get_client()
    try:
        response = client.messages.create(
            model=model or settings.AI_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.APIStatusError as exc:
        logger.error("AI provider returned status %s", exc.status_code)
        raise AIServiceError(f"AI provider error (status {exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        logger.error("AI provider connection failed: %s", exc.__class__.__name__)
        raise AIServiceError("Could not reach the AI provider.") from exc

    text = next((block.text for block in response.content if block.type == "text"), "")
    if not text:
        raise AIServiceError("AI provider returned an empty response.")
    return text
```

**Never log `user_prompt`, `system`, or `text`** — ticket content and customer data may appear in any of the three, and `CONVENTIONS.md` § 10 ("Never log secrets... No request bodies... in a log call") already forbids logging request/response bodies; the two `logger.error` calls above log only the exception class/status code, never the prompt or the provider's response text.

---

### 4 — Shared prompt-building utilities and KB grounding

**Create file: `backend/apps/ai/prompts.py`**

```python
"""Shared prompt-building utilities and KB grounding — AI-0's other
reusable piece (SupportOs backlog.MD:822). `ground_with_knowledge_base`
is the named caller `apps/knowledge_base/search.py::search_knowledge_base`
was built for (Story 41 `## Story Goal`, point 1).
"""

DEFAULT_GROUNDING_LIMIT = 5


def ground_with_knowledge_base(query: str, *, limit: int = DEFAULT_GROUNDING_LIMIT) -> list[dict]:
    """Published-only KB grounding for AI features. `include_drafts` is
    always `False` here — unlike `KnowledgeBaseSearchView`'s
    permission-elevated search (Story 41), an AI-generated answer must
    never surface unpublished content to whoever reads it. Imported
    lazily inside the function, not at module scope, so `apps.ai` importing
    `apps.knowledge_base` at Django startup cannot create an app-loading
    order hazard between two independently-migrated apps.
    """
    from apps.knowledge_base.search import search_knowledge_base

    return search_knowledge_base(query, limit=limit, include_drafts=False)


def format_kb_context(results: list[dict]) -> str:
    """Render `search_knowledge_base`'s merged FAQ/Article results
    (Story 41's two result shapes) as a numbered plain-text block for
    insertion into a system prompt. Returns `""` for an empty list —
    callers append this to their own instructions unconditionally.
    """
    if not results:
        return ""
    lines = []
    for index, result in enumerate(results, start=1):
        if result["kind"] == "faq":
            lines.append(f"{index}. Q: {result['question']}\n   A: {result['answer']}")
        else:
            lines.append(f"{index}. {result['title_en']}\n   {result['headline_en'] or ''}")
    return "\n".join(lines)


def build_grounded_system_prompt(instructions: str, *, kb_query: str | None = None) -> str:
    """Compose a system prompt, optionally grounded in the knowledge base.
    The one place every AI-1..AI-5 story builds its system prompt, so
    grounding format stays consistent across features (backlog's "single
    AI integration point"). Returns `instructions` unchanged when
    `kb_query` is omitted or the search returns nothing.
    """
    if not kb_query:
        return instructions
    context = format_kb_context(ground_with_knowledge_base(kb_query))
    if not context:
        return instructions
    return f"{instructions}\n\nRelevant knowledge base context:\n{context}"
```

---

## Documentation Tasks

### 5 — `.env.example`

**File: `backend/.env.example`** — add a new section, after the SMS block and before the Media block:

```
# --- AI (AI-0) ---
ANTHROPIC_API_KEY=
AI_MODEL=claude-opus-5
```

---

### 6 — README

**File: `README.md`** — add two rows to the backend environment-variable table, after the `MEDIA_ROOT` row:

```markdown
| `ANTHROPIC_API_KEY` | no | *(empty — AI features refuse to run until set)* | API key for Anthropic's Claude API — the one AI provider integration point (AI-0). |
| `AI_MODEL` | no | `claude-opus-5` | Claude model id `apps.ai.client.generate_completion` uses by default. |
```

---

### 7 — Conventions

**File: `CONVENTIONS.md`** — add a new top-level section, `## 28. AI service foundation (AI-0)`, after the end of `## 27. Reporting (RPT-0)` (end of file):

```markdown
## 28. AI service foundation (AI-0)

`AI-0` (Story 74) is the shared foundation `AI-1`…`AI-5` build on — see
§ EPIC 13 in `SupportOs backlog.MD`.

**`apps/ai/client.py` is the only place `anthropic` is imported.** A
feature calls `generate_completion(...)`; it never constructs its own
`anthropic.Anthropic()` client or reads `settings.ANTHROPIC_API_KEY`
directly. This is what "single AI integration point" (the backlog's own
phrase) means in code: one client, one call signature, one exception
type (`apps.ai.exceptions.AIServiceError`) every consumer catches instead
of an `anthropic.*` exception class.

**`apps/ai/prompts.py::ground_with_knowledge_base` is how an AI feature
reads the knowledge base — never a second call into
`apps.knowledge_base.search.search_knowledge_base` with `include_drafts`
left to the caller's judgment.** It is hardcoded to `include_drafts=False`:
an AI-generated answer must never surface unpublished KB content, unlike
`KnowledgeBaseSearchView`'s permission-elevated human-facing search
(§ `KB-3`).

**No AI credential is ever logged, and neither is a prompt or a
response.** Ticket content, KB content, and customer data can appear in
any of the three; § 10's "never log secrets, never log request bodies"
rule applies to `apps/ai/client.py`'s own error logging exactly as it
does everywhere else — log the exception class or provider status code,
never the payload.

**`AI_MODEL` is an environment variable, not a per-feature constant.** A
story that needs a different model tier for its own task passes `model=`
to `generate_completion` explicitly; it does not add a second
`AI_*_MODEL` environment variable.
```

---

## Edge Cases & Failure Modes

- **`ANTHROPIC_API_KEY` is blank (the out-of-the-box state in every environment until configured).** `get_client()` raises `AIServiceError` before constructing an `anthropic.Anthropic()` instance — no request is ever attempted with an empty key. Any story that calls `generate_completion` without first checking configuration gets this exception, which (uncaught) becomes a logged `500 internal_error` envelope (`apps/core/exceptions.py:98-112`), not a cryptic SDK-level `AuthenticationError` traceback.
- **The Anthropic API returns a non-2xx status** (rate limit, invalid model id, service outage) — caught as `anthropic.APIStatusError`, logged with the status code only (never the request/response body), re-raised as `AIServiceError`.
- **A network failure or timeout reaching the API** — caught as `anthropic.APIConnectionError`, logged with only the exception class name, re-raised as `AIServiceError`. The SDK's own default retry policy (`max_retries=2`, exponential backoff on connection errors and 429/5xx) already runs underneath `client.messages.create` before this codepath is reached — `client.py` does not implement a second retry loop on top of it.
- **The model responds with no text content block** (e.g. a response consisting only of a refusal or an empty turn) — `generate_completion` raises `AIServiceError("AI provider returned an empty response.")` rather than returning `""` silently, so a caller cannot mistake "the model said nothing" for "the model said an empty string."
- **`ground_with_knowledge_base` is called with an empty or whitespace-only query** — delegates directly to `search_knowledge_base`, which returns `[]` for a query with no matches; `format_kb_context([])` returns `""`, and `build_grounded_system_prompt` falls back to the caller's plain `instructions` with no grounding block appended. No `AIServiceError` is raised for this case — a KB miss is not an AI-service failure.
- **`apps.ai.prompts` importing `apps.knowledge_base.search` at Django startup** — avoided by importing inside `ground_with_knowledge_base`'s function body rather than at module scope, so `apps.ai`'s own app-loading order relative to `apps.knowledge_base` in `INSTALLED_APPS` (`base.py` lines 55-70, `ai` after `knowledge_base`) cannot create an import-time hazard for either app.
- **A future story passes `max_tokens` too low for its own output shape** — its own concern; `generate_completion` does not clamp or override a caller-supplied `max_tokens`, and the Anthropic API's own `max_tokens` stop reason (`stop_reason == "max_tokens"`) is not specially handled here — a future story that cares distinguishes it via the raw `anthropic.Message` if it needs to (this function currently returns only the extracted text, not the full response object, matching every named `AI-1`…`AI-4` use case's "one text answer" shape).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

The mechanical checks that stand in for it:

1. `python manage.py check` — confirms `apps/ai/client.py`, `apps/ai/exceptions.py`, and `apps/ai/prompts.py` import cleanly, and that the new `ANTHROPIC_API_KEY`/`AI_MODEL` settings do not break settings loading.
2. `python manage.py test` — reports the same **54** passing as before this story (no model, no migration).
3. `ruff format --check .` / `ruff check .` over the three new Python files and the two edited ones (`requirements.txt` has no lint surface; `config/settings/base.py`).
4. Real Django-shell verification (no live API key required for the negative case; a real key exercises the positive case) — see `## Verification Steps`.
5. No frontend changes — `npm run lint`/`format:check`/`check:rtl`/`build` are unaffected; confirmed via `git status`/diff that nothing under `frontend/` changed.

---

## Migration / Rollback

**No migration in this story.** `apps/ai/models.py` is untouched.

**Rollback:** revert the commits (`requirements.txt`, the three new `apps/ai/` files, `config/settings/base.py`, `.env.example`, `README.md`, `CONVENTIONS.md`). Nothing to reverse at the database level.

**Half-applied states to avoid:**

- **`requirements.txt` updated but `pip install -r requirements.txt` not re-run.** `apps/ai/client.py`'s `import anthropic` then fails at Django startup with `ModuleNotFoundError`, caught immediately by `python manage.py check`/`runserver`.
- **`ANTHROPIC_API_KEY`/`AI_MODEL` added to `base.py` but not to `.env.example`.** Not a runtime failure (both have `default=""`/`default="claude-opus-5"`), but violates this project's own "add to `.env.example` and the README table in the same commit" rule (`README.md` § Environment variables) — the next developer would not discover the variable.
- **A future story imports `apps.knowledge_base.search` at module scope inside `apps/ai/prompts.py`** instead of inside the function — do not "clean this up" without checking `INSTALLED_APPS` ordering first; the deferred import in task 4 is deliberate, not an oversight.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `pip install -r requirements.txt` (installs `anthropic`), `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing, unchanged.
3. **Unconfigured behavior, verified via shell, no API key required:**
   ```powershell
   python manage.py shell -c "from apps.ai.client import generate_completion; generate_completion('hello')"
   ```
   With `ANTHROPIC_API_KEY` blank (the default `.env` state), this raises `apps.ai.exceptions.AIServiceError: AI features are not configured (ANTHROPIC_API_KEY is blank).` — not an `anthropic.*` exception, not a bare `KeyError`/`AttributeError`.
4. **Configured behavior, verified via shell, with a real key set in `backend/.env`:**
   ```powershell
   python manage.py shell -c "from apps.ai.client import generate_completion; print(generate_completion('Say the word OK and nothing else.', max_tokens=16))"
   ```
   Returns a non-empty string containing the model's reply, with no traceback.
5. **KB grounding, verified via shell** (against at least one existing published `FAQ` or `Article` row — seed one first if none exist locally):
   ```powershell
   python manage.py shell -c "from apps.ai.prompts import build_grounded_system_prompt; print(build_grounded_system_prompt('You are a support assistant.', kb_query='<a term known to match an existing FAQ/Article>'))"
   ```
   Output includes the base instructions plus a "Relevant knowledge base context:" block listing the matching FAQ/Article; the same call with a query guaranteed to match nothing returns the base instructions unchanged, with no "Relevant knowledge base context:" block.
6. **No frontend regression:** confirm via `git status`/diff that nothing under `frontend/` changed.

---

## Done Criteria

- [ ] `requirements.txt` gains `anthropic>=1.0,<2` (range-pin style matching the file's existing lines).
- [ ] `config/settings/base.py` gains `ANTHROPIC_API_KEY` (no safe default, read via `env(...)`) and `AI_MODEL` (default `"claude-opus-5"`, read via `env(...)`).
- [ ] `apps/ai/exceptions.py` — `AIServiceError`.
- [ ] `apps/ai/client.py` — `get_client()` (refuses to run against a blank `ANTHROPIC_API_KEY`) and `generate_completion(user_prompt, *, system=None, max_tokens=4096, model=None)`, the single function every later `AI-*` story calls; no other module in the codebase imports `anthropic`.
- [ ] `apps/ai/prompts.py` — `ground_with_knowledge_base` (calls `apps.knowledge_base.search.search_knowledge_base` with `include_drafts=False`, imported lazily), `format_kb_context`, `build_grounded_system_prompt`.
- [ ] **No new Django model, no migration, no permission constant, no API endpoint, no frontend change.**
- [ ] No log call anywhere in `apps/ai/` logs a prompt, a system instruction, or a model response — only exception classes / status codes.
- [ ] `backend/.env.example` — `ANTHROPIC_API_KEY`/`AI_MODEL` added under a new `# --- AI (AI-0) ---` header.
- [ ] `README.md` — `ANTHROPIC_API_KEY`/`AI_MODEL` rows added to the backend environment-variable table.
- [ ] `CONVENTIONS.md` — new `## 28. AI service foundation (AI-0)` section.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified live: an unconfigured client raises `AIServiceError` (not an SDK exception); a configured client returns real model text; `build_grounded_system_prompt` appends KB context when a match exists and omits the block when it doesn't.
- [ ] No frontend change (`git status`/diff confirms).
- [ ] `.squad/plans/ai-features/00-overview.md` updated with this story's row.
- [ ] `.squad/plans/00-index.md` gains a new `ai-features` row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 75.** This unblocks `AI-1` (Ticket Summaries, `SUPPORTOS-83`, depends only on this story), `AI-2` (Suggested Replies, `SUPPORTOS-84`, depends on this story + `COMM-0`, complete), `AI-3` (Automatic Categorization, `SUPPORTOS-85`, depends on this story + `TKT-2`, complete), `AI-4` (Suggested Solutions, `SUPPORTOS-86`, depends on this story + `KB-3`, complete), and `AI-5` (AI Chatbot, `SUPPORTOS-87`, depends on this story + `KB-3` + `PORTAL-0`, complete) — all five are now unblocked on the code side and can be planned in any order.
