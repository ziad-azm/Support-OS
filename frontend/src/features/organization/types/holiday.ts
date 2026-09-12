/** Mirrors `apps.organization.serializers.HolidaySerializer`'s read
 * shape. `date` is a `"YYYY-MM-DD"` string, matching a native
 * `<input type="date">`'s value exactly. */
export type Holiday = {
  id: number
  calendar: number
  date: string
  label: string
  created_at: string
  updated_at: string
}

export type HolidayInput = {
  calendar: number
  date: string
  label: string
}
