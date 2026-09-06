import type { LandingContent, LandingHighlight } from '@/shared/landing'

/** Mirrors `apps.organization.serializers.LandingContentAdminSerializer`'s
 * read shape: every public field except the nested `highlights` (those live
 * on `/api/landing-highlights/`), plus the server-managed id and timestamps.
 *
 * Derived from the shared `LandingContent` rather than restating twenty-one
 * column names — the backend derives its admin field tuple from the public
 * one the same way (`PublicLandingContentSerializer.Meta.fields[:-1]`). */
export type LandingContentAdmin = Omit<LandingContent, 'highlights'> & {
  id: number
  created_at: string
  updated_at: string
}

/** The write shape — no `id`/`created_at`/`updated_at`, all server-managed.
 * Every field is always sent (`''` to clear), never omitted (CONVENTIONS.md
 * §23, "PATCH for edits"). */
export type LandingContentInput = Omit<LandingContent, 'highlights'>

/** One highlight row as the admin list reads it — the public shape plus the
 * timestamps `LandingHighlightSerializer` carries. */
export type LandingHighlightRow = LandingHighlight & {
  created_at: string
  updated_at: string
}

/** The write shape for one highlight card. */
export type LandingHighlightInput = Omit<LandingHighlight, 'id'>
