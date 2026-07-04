// components/ui/web-dom-props.ts
// Strips React Native props before spreading onto DOM elements (web / NativeWind).
type RecordProps = Record<string, unknown>;

/** RN View/Text props that must never reach a DOM node on web. */
const RN_DOM_BLOCKLIST = new Set([
  "style",
  "collapsable",
  "focusable",
  "accessible",
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
  "accessibilityHint",
  "accessibilityActions",
  "accessibilityValue",
  "accessibilityLiveRegion",
  "accessibilityElementsHidden",
  "accessibilityViewIsModal",
  "importantForAccessibility",
  "accessibilityLabelledBy",
  "accessibilityLanguage",
  "nativeID",
  "testID",
  "hitSlop",
  "onLayout",
  "onStartShouldSetResponder",
  "onMoveShouldSetResponder",
  "onResponderGrant",
  "onResponderMove",
  "onResponderRelease",
  "onResponderTerminate",
  "onResponderTerminationRequest",
  "removeClippedSubviews",
  "needsOffscreenAlphaCompositing",
  "renderToHardwareTextureAndroid",
  "shouldRasterizeIOS",
]);

export function webDomProps<T extends RecordProps>(props: T): RecordProps {
  const safe: RecordProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (RN_DOM_BLOCKLIST.has(key)) continue;
    if (key.startsWith("accessibility")) continue;
    safe[key] = value;
  }
  return safe;
}

/**
 * Flatten RN style arrays for rare cases where `style` must be applied on web.
 * Prefer `className` instead of `style` on web.
 */
export function flattenStyleForWeb(
  style: unknown
): Record<string, unknown> | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    const { StyleSheet } = require("react-native") as typeof import("react-native");
    return StyleSheet.flatten(style) as Record<string, unknown>;
  }
  if (typeof style === "object") {
    return style as Record<string, unknown>;
  }
  return undefined;
}
