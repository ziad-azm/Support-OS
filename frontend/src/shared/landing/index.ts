export { useLandingContent } from './useLandingContent'
export { resolveLanding } from './resolve'
export { landingKeys } from './landingKeys'
export {
  DEFAULT_ICON_KEY,
  isCtaTarget,
  isIconKey,
  landingIcon,
  LANDING_CTA_TARGETS,
  LANDING_ICON_KEYS,
} from './config'
export type { LandingCtaTarget, LandingIconKey } from './config'
export { LandingIcon } from './LandingIcon'
export { Reveal } from './Reveal'
export {
  LandingCtaBand,
  LandingFeatures,
  LandingFooter,
  LandingHero,
} from './sections/LandingSections'
export type { LandingContent, LandingHighlight, ResolvedHighlight, ResolvedLanding } from './types'
// `fetchLandingContent` is deliberately NOT re-exported — nothing outside
// this module calls it, the same restraint `shared/branding/index.ts` shows.
