import { api } from '@/shared/lib/api/client'

import type { WorkingWindow, WorkingWindowInput } from '../types/workingWindow'

export function createWorkingWindow(input: WorkingWindowInput): Promise<WorkingWindow> {
  return api.post<WorkingWindow>('/working-windows/', input)
}
