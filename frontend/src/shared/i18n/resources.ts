import accountsAr from '@/features/accounts/locales/ar.json'
import accountsEn from '@/features/accounts/locales/en.json'
import authAr from '@/features/auth/locales/ar.json'
import authEn from '@/features/auth/locales/en.json'
import customersAr from '@/features/customers/locales/ar.json'
import customersEn from '@/features/customers/locales/en.json'
import healthAr from '@/features/health/locales/ar.json'
import healthEn from '@/features/health/locales/en.json'
import knowledgeBaseAr from '@/features/knowledge-base/locales/ar.json'
import knowledgeBaseEn from '@/features/knowledge-base/locales/en.json'
import liveChatAr from '@/features/live-chat/locales/ar.json'
import liveChatEn from '@/features/live-chat/locales/en.json'
import notificationsAr from '@/features/notifications/locales/ar.json'
import notificationsEn from '@/features/notifications/locales/en.json'
import portalAr from '@/features/portal/locales/ar.json'
import portalEn from '@/features/portal/locales/en.json'
import tasksAr from '@/features/tasks/locales/ar.json'
import tasksEn from '@/features/tasks/locales/en.json'
import ticketsAr from '@/features/tickets/locales/ar.json'
import ticketsEn from '@/features/tickets/locales/en.json'
import webFormAr from '@/features/web-form/locales/ar.json'
import webFormEn from '@/features/web-form/locales/en.json'

import arCommon from './locales/ar/common.json'
import arErrors from './locales/ar/errors.json'
import arValidation from './locales/ar/validation.json'
import enCommon from './locales/en/common.json'
import enErrors from './locales/en/errors.json'
import enValidation from './locales/en/validation.json'

/**
 * The whole resource map, explicitly registered.
 *
 * Deliberately not `import.meta.glob`: an explicit map is greppable, fully
 * typed under `strict`, and shows every namespace in one place. Adding a
 * feature costs two imports and one line per language — that is the
 * "every feature adds its own namespace" checklist item.
 */
export const resources = {
  en: {
    common: enCommon,
    errors: enErrors,
    validation: enValidation,
    health: healthEn,
    auth: authEn,
    accounts: accountsEn,
    customers: customersEn,
    tickets: ticketsEn,
    liveChat: liveChatEn,
    webForm: webFormEn,
    notifications: notificationsEn,
    portal: portalEn,
    tasks: tasksEn,
    knowledgeBase: knowledgeBaseEn,
  },
  ar: {
    common: arCommon,
    errors: arErrors,
    validation: arValidation,
    health: healthAr,
    auth: authAr,
    accounts: accountsAr,
    customers: customersAr,
    tickets: ticketsAr,
    liveChat: liveChatAr,
    webForm: webFormAr,
    notifications: notificationsAr,
    portal: portalAr,
    tasks: tasksAr,
    knowledgeBase: knowledgeBaseAr,
  },
} as const

export type AppResources = (typeof resources)['en']
