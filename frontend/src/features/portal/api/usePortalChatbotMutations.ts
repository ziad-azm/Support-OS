import { useMutation, useQueryClient } from '@tanstack/react-query'

import { handOffPortalChatbot } from './handOffPortalChatbot'
import { portalChatbotKeys } from './portalChatbotKeys'
import { sendPortalChatbotMessage } from './sendPortalChatbotMessage'
import type { PortalChatbotState } from '../types/portalChatbot'

/** Both mutations return the full state, so they seed the query cache
 * directly (`setQueryData`) instead of invalidating and refetching — one
 * round trip, and the bot's reply is already in hand. */
export function useSendPortalChatbotMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => sendPortalChatbotMessage(body),
    onSuccess: (state: PortalChatbotState) =>
      queryClient.setQueryData(portalChatbotKeys.resource('conversation'), state),
  })
}

export function useHandOffPortalChatbot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => handOffPortalChatbot(),
    onSuccess: (state: PortalChatbotState) =>
      queryClient.setQueryData(portalChatbotKeys.resource('conversation'), state),
  })
}
