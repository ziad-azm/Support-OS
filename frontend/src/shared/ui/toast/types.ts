export type ToastTone = 'error' | 'success' | 'info'

export type Toast = {
  id: string
  tone: ToastTone
  message: string
}

export type PushToastInput = {
  tone: ToastTone
  message: string
}
