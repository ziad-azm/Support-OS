import { useQuery } from '@tanstack/react-query'

import { departmentKeys } from '@/shared/departments'

import { getDepartmentList } from './getDepartmentList'
import type { DepartmentListParams } from './getDepartmentList'

export function useDepartmentList(params: DepartmentListParams) {
  return useQuery({
    queryKey: departmentKeys.resource('list', params),
    queryFn: () => getDepartmentList(params),
  })
}
