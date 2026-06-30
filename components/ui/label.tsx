// components/ui/label.tsx
// shadcn/react-native-reusables form label.
import * as React from "react";
import { Text } from "react-native";
import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn(
        "text-sm font-medium leading-none text-foreground web:peer-disabled:cursor-not-allowed web:peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Label };
