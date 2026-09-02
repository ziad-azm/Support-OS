import { api } from '@/shared/lib/api/client'

import type { Department, DepartmentInput } from '../types/department'

export function createDepartment(input: DepartmentInput): Promise<Department> {
  return api.post<Department>('/departments/', input)
}
