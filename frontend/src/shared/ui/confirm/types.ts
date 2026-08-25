export type ConfirmOptions = {
  /** Already translated by the caller — this module never guesses copy. */
  title: string
  description?: string
  /** Label for the confirming action. Defaults to common:actions.confirm. */
  confirmLabel?: string
  /** Label for the cancelling action. Defaults to common:actions.cancel. */
  cancelLabel?: string
  /** Render the confirm button as destructive. Default: false. */
  destructive?: boolean
}
