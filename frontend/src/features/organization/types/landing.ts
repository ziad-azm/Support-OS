import type { LandingContent, LandingHighlight, LandingSocialLink } from '@/shared/landing'

/** Mirrors `apps.organization.serializers.LandingContentAdminSerializer`'s
 * read shape: every public field except the two nested lists (`highlights`
 * lives on `/api/landing-highlights/`, `social_links` on
 * `/api/landing-social-links/`), plus the server-managed id and timestamps.
 *
 * Derived from the shared `LandingContent` rather than restating twenty-one
 * column names — the backend derives its admin field tuple from the public
 * one the same way (`PublicLandingContentSerializer.Meta.fields[:-2]` —
 * Story 95 widened that slice from `[:-1]` when it added `social_links`). */
export type LandingContentAdmin = Omit<LandingContent, 'highlights' | 'social_links'> & {
  id: number
  created_at: string
  updated_at: string
}

/** The write shape — no `id`/`created_at`/`updated_at`, all server-managed.
 * Every field is always sent (`''` to clear), never omitted (CONVENTIONS.md
 * §23, "PATCH for edits"). */
export type LandingContentInput = Omit<LandingContent, 'highlights' | 'social_links'>

/** One highlight row as the admin list reads it — the public shape plus the
 * timestamps `LandingHighlightSerializer` carries. */
export type LandingHighlightRow = LandingHighlight & {
  created_at: string
  updated_at: string
}

/** The write shape for one highlight card. */
export type LandingHighlightInput = Omit<LandingHighlight, 'id'>

/** One social/contact link row as the admin list reads it — the public
 * shape plus `is_enabled` and the timestamps `LandingSocialLinkSerializer`
 * carries. */
export type LandingSocialLinkRow = LandingSocialLink & {
  is_enabled: boolean
  created_at: string
  updated_at: string
}

/** The write shape for one social/contact link. */
export type LandingSocialLinkInput = Omit<LandingSocialLinkRow, 'id' | 'created_at' | 'updated_at'>
