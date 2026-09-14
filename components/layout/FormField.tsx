// components/layout/FormField.tsx
// One place for label + required marker + hint + error, so every screen's
// form fields look the same (spec §2.6, INV-3/INV-4: no more validation
// errors sitting 1200px away from the field, no more missing "*").
import { cloneElement, isValidElement, type ReactNode } from "react";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";

export type FormFieldProps = {
  label: string;
  /** Renders "*" next to the label and sets aria-required on the field. */
  required?: boolean;
  hint?: string;
  /** Rendered directly under the field, in destructive color; also borders the child. */
  error?: string;
  children: ReactNode;
  className?: string;
};

function withDestructiveBorder(children: ReactNode): ReactNode {
  if (!isValidElement(children)) return children;
  const existing =
    typeof (children.props as { className?: unknown })?.className === "string"
      ? ((children.props as { className?: string }).className as string)
      : "";
  return cloneElement(children as React.ReactElement<{ className?: string }>, {
    className: `${existing} border-destructive`.trim(),
    "aria-invalid": true,
  } as Record<string, unknown>);
}

export function FormField({
  label,
  required = false,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  const hasError = Boolean(error);

  return (
    <VStack testID="form-field" space="xs" className={className}>
      <HStack space="xs" className="items-center">
        <Text
          size="xs"
          className="font-medium uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </Text>
        {required ? (
          <Text
            testID="form-field-required"
            size="xs"
            className="font-medium text-destructive"
            accessibilityLabel="required"
          >
            *
          </Text>
        ) : null}
      </HStack>
      <Box aria-required={required || undefined}>
        {hasError ? withDestructiveBorder(children) : children}
      </Box>
      {hasError ? (
        <Text testID="form-field-error" size="xs" className="text-destructive">
          {error}
        </Text>
      ) : hint ? (
        <Text testID="form-field-hint" size="xs" className="text-muted-foreground">
          {hint}
        </Text>
      ) : null}
    </VStack>
  );
}
