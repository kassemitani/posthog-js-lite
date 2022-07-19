import React, { useCallback, useRef } from 'react'
import { GestureResponderEvent, StyleProp, View, ViewStyle } from 'react-native'
import { PostHog, PostHogOptions } from './posthog-rn'
import { PostHogAutocaptureElement } from 'posthog-core'

export interface PostHogProviderProps {
  children: React.ReactNode
  options?: PostHogOptions
  apiKey?: string
  client?: PostHog
  autocapture?: boolean
  style?: StyleProp<ViewStyle>
}

const DEFAULT_MAX_COMPONENT_TREE_SIZE = 20
const PROP_KEY = 'ph-label'
const NO_CAPTURE_KEY = 'ph-no-capture'

const _isNameIgnored = (name: string) => {
  return false
}

export const PostHogContext = React.createContext<{ client?: PostHog }>({ client: undefined })

interface Element {
  elementType?: {
    displayName?: string
    name?: string
  }
  memoizedProps?: Record<string, unknown>
  return?: Element
}

const doAutocapture = (e: any, posthog: PostHog) => {
  if (!e._targetInst) {
    return
  }
  const elements: PostHogAutocaptureElement[] = []

  let currentInst: Element | undefined = e._targetInst
  let activeLabel: string | undefined
  let activeDisplayName: string | undefined
  const componentTreeNames: string[] = []

  while (
    currentInst &&
    // maxComponentTreeSize will always be defined as we have a defaultProps. But ts needs a check so this is here.
    componentTreeNames.length < DEFAULT_MAX_COMPONENT_TREE_SIZE
  ) {
    const el: PostHogAutocaptureElement = {
      tag_name: '',
      attr_class: [],
      nth_child: 0,
      nth_of_type: 0,
      attributes: {},
      order: 0,
    }

    const props = currentInst.memoizedProps
    const label = typeof props?.[PROP_KEY] !== 'undefined' ? `${props[PROP_KEY]}` : undefined

    if (props) {
      Object.keys(props).forEach((key) => {
        if (['string', 'number', 'boolean'].includes(typeof props[key])) {
          el.attributes[key] = props[key]
        }
      })
    }

    if (props?.[NO_CAPTURE_KEY]) {
      // Immediately ignore events if a no capture is in the chain
      return
    }

    // Check the label first
    if (label && !_isNameIgnored(label)) {
      if (!activeLabel) {
        activeLabel = label
      }
      el.tag_name = label
      elements.push(el)
    } else if (typeof props?.accessibilityLabel === 'string' && !_isNameIgnored(props.accessibilityLabel)) {
      if (!activeLabel) {
        activeLabel = props.accessibilityLabel
      }
      el.tag_name = props.accessibilityLabel
      elements.push(el)
    } else if (currentInst.elementType) {
      const { elementType } = currentInst

      if (elementType.displayName && !_isNameIgnored(elementType.displayName)) {
        // Check display name
        if (!activeDisplayName) {
          activeDisplayName = elementType.displayName
        }
        el.tag_name = elementType.displayName
        elements.push(el)
      }
    }

    currentInst = currentInst.return
  }

  if (elements.length) {
    posthog.autocapture('touch', elements, {
      $touch_x: e.nativeEvent.pageX,
      $touch_y: e.nativeEvent.pageY,
    })
  }
}

export const PostHogProvider = ({ children, client, options, apiKey, autocapture, style }: PostHogProviderProps) => {
  const posthogRef = useRef<PostHog>()

  if (!posthogRef.current) {
    posthogRef.current = client ? client : apiKey ? new PostHog(apiKey, options) : undefined
  }

  const posthog = posthogRef.current

  const onTouch = useCallback(
    (type: 'start' | 'move' | 'end', e: GestureResponderEvent) => {
      if (!autocapture || !posthog) {
        return
      }

      if (type === 'end') {
        doAutocapture(e, posthog)
      }
    },
    [posthog, autocapture]
  )

  return (
    <View style={style || { flex: 1 }} onTouchEndCapture={(e) => onTouch('end', e)}>
      <PostHogContext.Provider value={{ client: posthogRef.current }}>{children}</PostHogContext.Provider>
    </View>
  )
}

export const usePostHog = (): PostHog | undefined => {
  const { client } = React.useContext(PostHogContext)
  return client
}
