/**
 * Query-key convention: [feature, resource, ...discriminators].
 * Features export their own key factory; this module holds only the helper so
 * the shape stays uniform and invalidation can target a whole feature.
 */
export function featureKey(feature: string) {
  return {
    all: [feature] as const,
    resource: (resource: string, ...rest: readonly unknown[]) =>
      [feature, resource, ...rest] as const,
  }
}
