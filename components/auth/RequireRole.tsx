// components/auth/RequireRole.tsx
// Redirects when the signed-in user lacks required role access.
import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/navigation";

type RequireRoleProps = {
  allow: (role: string | undefined) => boolean;
  children: ReactNode;
  fallbackHref?: typeof routes.dashboard;
};

export function RequireRole({
  allow,
  children,
  fallbackHref = routes.dashboard,
}: RequireRoleProps) {
  const { data: session, isPending } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!allow(role)) {
    return <Redirect href={fallbackHref} />;
  }

  return <>{children}</>;
}
