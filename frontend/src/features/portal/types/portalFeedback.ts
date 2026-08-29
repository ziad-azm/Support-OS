/** Mirrors `apps.tickets.models.Feedback.Rating` — matches CONVENTIONS.md
 * §25's already-recorded RPT-4 chart design verbatim; not an arbitrary
 * choice. See Story 47 `## Prerequisites`. */
export const PORTAL_FEEDBACK_RATINGS = ['satisfied', 'neutral', 'dissatisfied'] as const
export type PortalFeedbackRating = (typeof PORTAL_FEEDBACK_RATINGS)[number]

/** The write shape. `ticket` comes from the route param, never a field the
 * customer edits — see `PortalFeedbackFormPage`. */
export type PortalFeedbackInput = {
  ticket: number
  rating: PortalFeedbackRating
  comment: string
}

export type PortalFeedbackCreated = {
  id: number
}
