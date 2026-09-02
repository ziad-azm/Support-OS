import { api } from '@/shared/lib/api/client'

import type { Department, DepartmentInput } from '../types/department'

// PATCH, not PUT — matches `updateCategory.ts`.
export function updateDepartment(id: number, input: DepartmentInput): Promise<Department> {
  return api.patch<Department>(`/departments/${id}/`, input)
}
