// components/layout/ScreenLayout.tsx
// SafeArea scroll container with optional header slot.
import type { ReactNode } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";
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
    <VStack space="md" className="flex-1">
      {header ? <Box className="px-4 pt-4">{header}</Box> : null}
      <Box className="flex-1 px-4 pb-8">{children}</Box>
    </VStack>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right"]}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-28"
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
