import { useQuery } from '@tanstack/react-query'

import { getPortalChatbot } from './getPortalChatbot'
import { portalChatbotKeys } from './portalChatbotKeys'

export function usePortalChatbot() {
  return useQuery({
    queryKey: portalChatbotKeys.resource('conversation'),
    queryFn: getPortalChatbot,
  })
}
