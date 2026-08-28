import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createFaq } from './createFaq'
import { deleteFaq } from './deleteFaq'
import { faqKeys } from './faqKeys'
import { updateFaq } from './updateFaq'
import type { FaqInput } from '../types/faq'

// Every mutation invalidates the whole `faqs` key prefix — a create/edit
// changes ordering position and a delete shifts every later page, the same
// reasoning `useTaskMutations.ts` documents. CONVENTIONS.md §23.
function useInvalidateFaqs() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: faqKeys.all })
}

export function useCreateFaq() {
  const invalidate = useInvalidateFaqs()
  return useMutation({
    mutationFn: (input: FaqInput) => createFaq(input),
    onSuccess: invalidate,
  })
}

export function useUpdateFaq(id: number) {
  const invalidate = useInvalidateFaqs()
  return useMutation({
    mutationFn: (input: FaqInput) => updateFaq(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteFaq() {
  const invalidate = useInvalidateFaqs()
  return useMutation({
    mutationFn: (id: number) => deleteFaq(id),
    onSuccess: invalidate,
  })
}
