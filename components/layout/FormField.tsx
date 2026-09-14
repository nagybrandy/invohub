// components/layout/FormField.tsx
// Label + required marker + hint + error in one place, so no screen has to
// hand-roll the "*" / aria-required / error-below-field pattern again.
import type { ReactNode } from "react";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type FormFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, required, hint, error, children, className = "" }: FormFieldProps) {
  return (
    <VStack space="xs" className={className}>
      <Text size="xs" className="font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text size="xs" className="text-destructive" testID="form-field-error">
          {error}
        </Text>
      ) : hint ? (
        <Text size="xs" className="text-muted-foreground">
          {hint}
        </Text>
      ) : null}
    </VStack>
  );
}
