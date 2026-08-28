import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createArticle } from './createArticle'
import { deleteArticle } from './deleteArticle'
import { articleKeys } from './articleKeys'
import { updateArticle } from './updateArticle'
import type { ArticleInput } from '../types/article'

// Every mutation invalidates the whole `articles` key prefix — a status
// change or edit can move an article on/off the reader list and shift
// sort/page position on the manage table. CONVENTIONS.md §23.
function useInvalidateArticles() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: articleKeys.all })
}

export function useCreateArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: (input: ArticleInput) => createArticle(input),
    onSuccess: invalidate,
  })
}

export function useUpdateArticle(id: number) {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: (input: ArticleInput) => updateArticle(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: (id: number) => deleteArticle(id),
    onSuccess: invalidate,
  })
}
