/**
 * Minimal shape for the assignee selector, mirroring the plain array
 * `GET /tickets/assignable-agents/` returns. `name` is already resolved
 * server-side by `User.get_full_name()` (which falls back to the email),
 * so the UI never composes a display name itself.
 */
export type AgentOption = {
  id: number
  name: string
}
