/** Mirrors `apps.organization.models.WorkingWindow.Weekday` — Python's own
 * `datetime.weekday()` numbering (Monday=0 ... Sunday=6), so the backend
 * never needs to translate between two conventions. See Story 111
 * `## Prerequisites`. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

export type Weekday = (typeof WEEKDAYS)[number]

/** Mirrors `apps.organization.serializers.WorkingWindowSerializer`'s read
 * shape. `start_time`/`end_time` are `"HH:MM:SS"` strings, matching a
 * native `<input type="time">`'s `"HH:MM"` value up to the seconds DRF
 * appends. */
export type WorkingWindow = {
  id: number
  calendar: number
  weekday: Weekday
  start_time: string
  end_time: string
  created_at: string
  updated_at: string
}

export type WorkingWindowInput = {
  calendar: number
  weekday: Weekday
  start_time: string
  end_time: string
}
