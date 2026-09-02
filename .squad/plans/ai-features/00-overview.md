# ai-features — plan overview

Entry point for the **ai-features** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 74 | [74-story-ai-service-foundation-SUPPORTOS-82.md](74-story-ai-service-foundation-SUPPORTOS-82.md) | AI Service Foundation (AI-0) | SUPPORTOS-82 | None |
| 75 | [75-story-ticket-summaries-SUPPORTOS-83.md](75-story-ticket-summaries-SUPPORTOS-83.md) | Ticket Summaries (AI-1) | SUPPORTOS-83 | Story 74 |
| 76 | [76-story-suggested-replies-SUPPORTOS-84.md](76-story-suggested-replies-SUPPORTOS-84.md) | Suggested Replies (AI-2) | SUPPORTOS-84 | Story 74 (also reuses Story 75's `build_conversation_transcript`) |

## Dependency notes

Story 74 (`AI-0`) is the shared foundation every other `ai-features` story
depends on — `apps/ai/client.py` (the one AI provider integration point)
and `apps/ai/prompts.py` (shared prompt utilities + KB grounding via
`KB-3`). Once it lands:

- `AI-1` (Ticket Summaries, `SUPPORTOS-83`) depends only on Story 74 — **planned, Story 75.**
- `AI-2` (Suggested Replies, `SUPPORTOS-84`) depends on Story 74 + `COMM-0` (complete) — **planned, Story 76.** Also reuses Story 75's `apps/tickets/summarization.py::build_conversation_transcript`, and relocates the language-resolution helper Story 75 first wrote into `apps/ai/prompts.py::resolve_language_name` (second consumer triggers the move — see Story 76 `## Prerequisites`).
- `AI-3` (Automatic Categorization, `SUPPORTOS-85`) depends on Story 74 + `TKT-2` (complete).
- `AI-4` (Suggested Solutions, `SUPPORTOS-86`) depends on Story 74 + `KB-3` (complete, [../knowledge-base/41-story-knowledge-base-search-SUPPORTOS-54.md](../knowledge-base/41-story-knowledge-base-search-SUPPORTOS-54.md)).
- `AI-5` (AI Chatbot, `SUPPORTOS-87`) depends on Story 74 + `KB-3` + `PORTAL-0` (complete).
