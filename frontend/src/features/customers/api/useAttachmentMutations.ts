import { useMutation, useQueryClient } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { deleteAttachment } from './deleteAttachment'
import { uploadAttachment } from './uploadAttachment'
import type { UploadAttachmentInput } from '../types/attachment'

function useInvalidateAttachments(customerId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: customerKeys.resource('attachments', customerId) })
}

export function useUploadAttachment(customerId: number) {
  const invalidate = useInvalidateAttachments(customerId)
  return useMutation({
    mutationFn: (input: UploadAttachmentInput) => uploadAttachment(input),
    onSuccess: invalidate,
  })
}

export function useDeleteAttachment(customerId: number) {
  const invalidate = useInvalidateAttachments(customerId)
  return useMutation({
    mutationFn: (id: number) => deleteAttachment(id),
    onSuccess: invalidate,
  })
}
