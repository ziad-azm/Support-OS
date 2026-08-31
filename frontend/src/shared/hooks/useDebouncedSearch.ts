import { useEffect, useState } from 'react'

const SEARCH_DEBOUNCE_MS = 300

/** Debounced search-input state, reset-to-page-1 side effect included.
 *  Extracted from `UserListPage` (Story 48) once Roles/Categories adopted
 *  the same pattern — see CONVENTIONS.md's DSN-7 entry. */
export function useDebouncedSearch(setPage: (page: number) => void) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, setPage])

  return { searchInput, setSearchInput, search }
}
