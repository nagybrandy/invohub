// app/_layout.tsx
// Root layout: GluestackUIProvider, navigation theme, and top-level stack routes.
import "react-native-gesture-handler";
import "../global.css";
import "@/lib/i18n";

import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useColorScheme } from "@/lib/useColorScheme";

export {
  ErrorBoundary,
} from "expo-router";

const InvohubLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "rgb(246, 246, 248)",
    card: "rgb(255, 255, 255)",
    border: "rgb(197, 199, 202)",
    primary: "rgb(100, 149, 237)",
    text: "rgb(33, 35, 37)",
  },
};

const InvohubDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "rgb(9, 11, 16)",
    card: "rgb(18, 22, 30)",
    border: "rgb(38, 45, 61)",
    primary: "rgb(99, 102, 241)",
    text: "rgb(241, 245, 249)",
  },
};

export default function RootLayout() {
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  return (
    <GluestackUIProvider mode={colorScheme}>
      <ThemeProvider value={isDarkColorScheme ? InvohubDarkTheme : InvohubLightTheme}>
        <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="blog/index" />
          <Stack.Screen name="blog/[slug]" />
          <Stack.Screen name="login" />
          <Stack.Screen name="receipts/view" />
          <Stack.Screen name="aszf" />
          <Stack.Screen name="adatkezeles" />
          <Stack.Screen name="cookie-tajekoztato" />
          <Stack.Screen name="impresszum" />
          <Stack.Screen name="(app)" />
        </Stack>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
