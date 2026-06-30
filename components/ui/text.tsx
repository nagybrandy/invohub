// components/ui/text.tsx
// shadcn-style Text primitive. Exposes TextClassContext so containers (Button, Card) can cascade text styles.
import * as React from "react";
import { Text as RNText } from "react-native";
import { cn } from "@/lib/utils";

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  ...props
}: React.ComponentProps<typeof RNText>) {
  const textClass = React.useContext(TextClassContext);
  return (
    <RNText
      className={cn(
        "text-base text-foreground web:select-text",
        textClass,
        className
      )}
      {...props}
    />
  );
}

export { Text, TextClassContext };
