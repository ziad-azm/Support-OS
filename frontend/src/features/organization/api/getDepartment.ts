import { api } from '@/shared/lib/api/client'

import type { Department } from '../types/department'

export function getDepartment(id: number): Promise<Department> {
  return api.get<Department>(`/departments/${id}/`)
}
