import { useQuery } from '@tanstack/react-query'

import { departmentKeys } from '@/shared/departments'

import { getDepartment } from './getDepartment'

export function useDepartment(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: departmentKeys.resource('detail', id),
    queryFn: () => getDepartment(id),
    enabled: options?.enabled,
  })
}
