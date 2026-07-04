// app/(app)/products/_layout.tsx
// Accountants and admins only.
import { Slot } from "expo-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { canManageClients } from "@/lib/user-roles";

export default function ProductsLayout() {
  return (
    <RequireRole allow={canManageClients}>
      <Slot />
    </RequireRole>
  );
}
