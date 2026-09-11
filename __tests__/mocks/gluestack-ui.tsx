// __tests__/mocks/gluestack-ui.tsx
// Maps Gluestack UI primitives to React Native core for Jest renders.
import * as React from "react";
import {
  Pressable as RNPressable,
  Text as RNText,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";

export function Box(props: ViewProps) {
  return <View {...props} />;
}

export { Box as View };

export function VStack(props: ViewProps) {
  return <View {...props} />;
}

export function HStack(props: ViewProps) {
  return <View {...props} />;
}

export function Card(props: ViewProps) {
  return <View {...props} />;
}

export function Text(props: TextProps) {
  return <RNText {...props} />;
}

export function Heading(props: TextProps) {
  return <RNText {...props} />;
}

export function Pressable(props: PressableProps) {
  return <RNPressable {...props} />;
}

export function Button({
  children,
  onPress,
  testID,
  ...props
}: PressableProps & { children?: React.ReactNode; testID?: string }) {
  return (
    <RNPressable onPress={onPress} testID={testID} {...props}>
      {children}
    </RNPressable>
  );
}

export function ButtonText(props: TextProps) {
  return <RNText {...props} />;
}

export function Switch(props: ViewProps & { value?: boolean }) {
  return <View {...props} />;
}

export function Badge(props: ViewProps) {
  return <View {...props} />;
}

export function BadgeText(props: TextProps) {
  return <RNText {...props} />;
}
