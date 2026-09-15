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
  /**
   * "content" (default) caps at LAYOUT.contentMax (1200px) — every screen.
   * "form" caps at LAYOUT.formMax (720px) — a single-column form.
   * "full" — no cap (a screen that builds its own multi-column layout).
   */
  width?: "content" | "form" | "full";
};

const WIDTH_CLASS: Record<NonNullable<ScreenLayoutProps["width"]>, string> = {
  content: "max-w-[1200px]",
  form: "max-w-[720px]",
  full: "max-w-none",
};

export function ScreenLayout({
  children,
  header,
  scroll = true,
  scrollProps,
  width = "content",
}: ScreenLayoutProps) {
  const content = (
    <VStack
      testID="screen-layout-content"
      space="md"
      className={`w-full flex-1 mx-auto ${WIDTH_CLASS[width]} pt-5 md:pt-8`}
    >
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
