import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Category } from '../types/category'

export type CategoryListParams = ServerTableParams & { search?: string }

export function getCategoryList(params: CategoryListParams): Promise<Page<Category>> {
  return api.getPage<Category>('/article-categories/', { params })
}
