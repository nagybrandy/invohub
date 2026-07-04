// components/layout/FormScreen.tsx
// Scroll form layout with footer action slot.
import type { ReactNode } from "react";
import { Box } from "@/components/ui/box";
import { ScreenLayout } from "@/components/layout/ScreenLayout";

type FormScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

export function FormScreen({ children, header, footer }: FormScreenProps) {
  return (
    <ScreenLayout header={header}>
      {children}
      {footer ? <Box className="mt-6">{footer}</Box> : null}
    </ScreenLayout>
  );
}
