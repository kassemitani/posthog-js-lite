import { useEffect, useState } from 'react'
import type { PostHog } from '../posthog-rn'
import { usePostHog } from '../PostHogProvider'
import { PostHogDecideResponse } from 'posthog-core'

export function useFeatureFlags(client?: PostHog) {
  const contextClient = usePostHog()
  const posthog = client || contextClient

  const [featureFlags, setFeatureFlags] = useState<PostHogDecideResponse['featureFlags'] | undefined>(
    posthog?.getFeatureFlags()
  )

  if (!posthog) return featureFlags

  useEffect(() => {
    setFeatureFlags(posthog.getFeatureFlags())
    return posthog.onFeatureFlags((flags) => {
      setFeatureFlags(flags)
    })
  }, [posthog])

  return featureFlags
}
