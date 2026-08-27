import { api } from '@/shared/lib/api/client'

import type { WebFormCategory } from '../types/category'

// A plain array, not a paginated Page<T> — GET /web-form/categories/ is a
// small, curated public list (an APIView, not a ModelViewSet), unlike
// GET /categories/'s own paginated shape.
export function getWebFormCategories(): Promise<WebFormCategory[]> {
  return api.get<WebFormCategory[]>('/web-form/categories/')
}
