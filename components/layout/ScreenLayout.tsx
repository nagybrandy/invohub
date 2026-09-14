// components/layout/ScreenLayout.tsx
// SafeArea scroll container with optional header slot.
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";

type ScreenLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
};

export function ScreenLayout({
  children,
  header,
  scroll = true,
  scrollProps,
}: ScreenLayoutProps) {
  const content = (
    <VStack space="md" className="flex-1 pt-5 md:pt-8">
      {header ? <Box className="px-4 md:px-10">{header}</Box> : null}
      <Box className="flex-1 px-4 pb-8 md:px-10">{children}</Box>
    </VStack>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      {scroll ? (
        // Without this, a focused field low in a form (Recipient/Dates
        // cards, notes textarea) can end up hidden behind the on-screen
        // keyboard — there was no keyboard-avoidance anywhere in the app.
        // "padding" on iOS, "height" on Android (works without relying on
        // an android:windowSoftInputMode manifest setting).
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-28"
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
