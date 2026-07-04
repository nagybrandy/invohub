// components/layout/EmptyState.tsx
// Centered empty placeholder — use outside FlatList (web-safe).
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  loading = false,
  className = "py-16",
}: EmptyStateProps) {
  return (
    <View className={`flex-1 items-center justify-center ${className}`}>
      <VStack space="md" className="max-w-sm items-center px-6">
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Heading size="lg" className="text-center text-foreground">
              {title}
            </Heading>
            {description ? (
              <Text size="sm" className="text-center text-muted-foreground">
                {description}
              </Text>
            ) : null}
            {action}
          </>
        )}
      </VStack>
    </View>
  );
}
