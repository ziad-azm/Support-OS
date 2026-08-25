import { zodResolver as hookformZodResolver } from '@hookform/resolvers/zod'

/**
 * The project's only resolver. Features pass a schema to `useAppForm`
 * (shared/ui/form/useAppForm.ts) and never import from
 * `@hookform/resolvers` themselves — see CONVENTIONS.md §20.
 */
export const zodResolver = hookformZodResolver
