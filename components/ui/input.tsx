// components/ui/input.tsx
// shadcn/react-native-reusables text input field.
import * as React from "react";
import { TextInput } from "react-native";
import { cn } from "@/lib/utils";

function Input({
  className,
  placeholderClassName,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  placeholderClassName?: string;
}) {
  return (
    <TextInput
      className={cn(
        "h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground native:h-12 lg:text-sm",
        "web:flex web:py-2 web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2",
        props.editable === false && "opacity-50 web:cursor-not-allowed",
        className
      )}
      placeholderTextColor="hsl(240 3.8% 46.1%)"
      {...props}
    />
  );
}

export { Input };
