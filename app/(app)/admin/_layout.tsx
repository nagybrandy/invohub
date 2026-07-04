// app/(app)/admin/_layout.tsx
// Admin-only routes.
import { Slot } from "expo-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { canAccessAdminPanel } from "@/lib/user-roles";

export default function AdminLayout() {
  return (
    <RequireRole allow={canAccessAdminPanel}>
      <Slot />
    </RequireRole>
  );
}
