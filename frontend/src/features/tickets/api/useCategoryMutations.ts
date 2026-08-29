import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCategory } from './createCategory'
import { deleteCategory } from './deleteCategory'
import { updateCategory } from './updateCategory'
import { ticketKeys } from './ticketKeys'
import type { CategoryInput } from '../types/category'

// Invalidating the bare `ticketKeys.resource('categories')` prefix refreshes
// the admin list, any open detail query, AND the unrelated `useCategories()`
// dropdown query in one call — React Query matches `invalidateQueries` by
// array prefix.
function useInvalidateCategories() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ticketKeys.resource('categories') })
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(input),
    onSuccess: invalidate,
  })
}

export function useUpdateCategory(id: number) {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (input: CategoryInput) => updateCategory(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: invalidate,
  })
}
