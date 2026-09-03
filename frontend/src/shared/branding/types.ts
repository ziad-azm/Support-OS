/** Mirrors `apps.organization.serializers.BrandingSerializer`'s read shape —
 * the public face of `OrganizationSettings`. Lives in `shared/`, not
 * `features/organization/`, because `app/`, `features/auth`,
 * `features/landing`, and `features/portal` all need it and
 * `no-restricted-imports` forbids a cross-feature import
 * (CONVENTIONS.md §15/§19). */
export type Branding = {
  name: string
  logo_url: string
  primary_color: string
}

/** What a fresh deployment (or a failed fetch) falls back to — three
 * empty strings, which every consumer already treats as "use the
 * default": `BrandMark` renders the locale name, `apply()` removes its
 * inline overrides. */
export const EMPTY_BRANDING: Branding = { name: '', logo_url: '', primary_color: '' }
