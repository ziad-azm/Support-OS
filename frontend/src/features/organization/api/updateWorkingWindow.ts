import { api } from '@/shared/lib/api/client'

import type { WorkingWindow, WorkingWindowInput } from '../types/workingWindow'

export function updateWorkingWindow(id: number, input: WorkingWindowInput): Promise<WorkingWindow> {
  return api.patch<WorkingWindow>(`/working-windows/${id}/`, input)
}
