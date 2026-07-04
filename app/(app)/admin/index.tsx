// app/(app)/admin/index.tsx
// Admin panel: platform stats and user role management.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Shield, FileText } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StatCard } from "@/components/layout/StatCard";
import { apiFetch } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";
import { ALL_ROLES, roleLabel } from "@/lib/user-roles";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  companyName: string | null;
};

type AdminPayload = {
  users: AdminUser[];
  stats: {
    users: number;
    companies: number;
    invoices: number;
    clients: number;
    products: number;
  };
};

function AdminPanelContent() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [data, setData] = React.useState<AdminPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<AdminPayload>("/api/admin/users");
      setData(result);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(userId: string, role: string) {
    setBusyId(userId);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await load();
      setMessage(`Role updated to ${roleLabel(role)}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Role update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("admin.title")}
          subtitle={t("admin.subtitle")}
        />
      }
    >
      <VStack space="lg">
        {loading && !data ? (
          <Text className="text-muted-foreground">{t("common.loading")}</Text>
        ) : null}

        {data ? (
          <>
            <HStack space="md" className="flex-wrap">
              <StatCard label="Users" value={data.stats.users} />
              <StatCard label="Companies" value={data.stats.companies} />
              <StatCard label="Invoices" value={data.stats.invoices} />
              <StatCard label="Clients" value={data.stats.clients} />
              <StatCard label="Products" value={data.stats.products} />
            </HStack>

            <Card className="p-4">
              <VStack space="sm">
                <HStack space="sm" className="items-center">
                  <FileText size={20} color={icons.primary} />
                  <Text className="font-semibold text-foreground">
                    {t("admin.apiDocsOpen")}
                  </Text>
                </HStack>
                <Text size="sm" className="text-muted-foreground">
                  {t("admin.apiDocsOpenHint")}
                </Text>
                <Button onPress={() => router.push(routes.adminApiDocs)}>
                  <ButtonText>{t("admin.apiDocsOpen")}</ButtonText>
                </Button>
              </VStack>
            </Card>

            <VStack space="sm">
              <HStack space="sm" className="items-center">
                <Shield size={20} color={icons.accent} />
                <Text className="font-semibold text-foreground">{t("admin.users")}</Text>
              </HStack>
              <Text size="sm" className="text-muted-foreground">
                {t("admin.usersHint")}
              </Text>

              {data.users.map((user) => (
                <Card key={user.id} className="p-4">
                  <VStack space="sm">
                    <HStack className="items-start justify-between gap-2">
                      <VStack className="flex-1">
                        <Text className="font-semibold text-foreground">{user.name}</Text>
                        <Text size="sm" className="text-muted-foreground">
                          {user.email}
                        </Text>
                        {user.companyName ? (
                          <Text size="xs" className="text-muted-foreground">
                            {user.companyName}
                          </Text>
                        ) : null}
                      </VStack>
                      <Text size="sm" className="font-medium text-primary">
                        {roleLabel(user.role)}
                      </Text>
                    </HStack>
                    <HStack space="xs" className="flex-wrap">
                      {ALL_ROLES.map((role) => (
                        <Pressable
                          key={role}
                          onPress={() => void changeRole(user.id, role)}
                          disabled={busyId === user.id || user.role === role}
                        >
                          <Button
                            size="sm"
                            variant={user.role === role ? "default" : "outline"}
                            disabled={busyId === user.id || user.role === role}
                          >
                            <ButtonText>{roleLabel(role)}</ButtonText>
                          </Button>
                        </Pressable>
                      ))}
                    </HStack>
                  </VStack>
                </Card>
              ))}
            </VStack>
          </>
        ) : null}

        {message ? (
          <Card className="border-primary/30 bg-accent p-3">
            <Text size="sm">{message}</Text>
          </Card>
        ) : null}

        <Button variant="outline" onPress={() => void load()} disabled={loading}>
          <ButtonText>{t("common.refresh")}</ButtonText>
        </Button>
      </VStack>
    </ScreenLayout>
  );
}

export default AdminPanelContent;
