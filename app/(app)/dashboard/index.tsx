// app/(app)/dashboard/index.tsx
// Dashboard with stats and links to all features not in the bottom tab bar.
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileText } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FeatureLinkCard } from "@/components/layout/FeatureLinkCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StatCard } from "@/components/layout/StatCard";
import { getDashboardFeatures } from "@/lib/app-navigation";
import { useSession } from "@/lib/auth-client";
import { useIconColors } from "@/lib/theme/icon-colors";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";

export default function DashboardScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const features = getDashboardFeatures(userRole);
  const { invoices, stats, loading } = useInvoices();

  const overdue = invoices.filter((i) => i.status === "overdue").length;
  const drafts = invoices.filter((i) => i.status === "draft" || i.status === "proforma").length;
  const paidThisMonth = invoices.filter(
    (i) => i.status === "paid" && i.issueDate.slice(0, 7) === new Date().toISOString().slice(0, 7)
  ).length;

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("nav.dashboard")}
          subtitle={t("dashboard.subtitle")}
        />
      }
    >
      <VStack space="lg">
        <HStack space="md" className="flex-wrap">
          <StatCard label="Total invoices" value={loading ? "…" : stats.count} />
          <StatCard label={t("dashboard.paidThisMonth")} value={loading ? "…" : paidThisMonth} />
          <StatCard
            label="Monthly total"
            value={loading ? "…" : formatCurrency(stats.monthlyTotal, "EUR")}
          />
        </HStack>

        <HStack space="md" className="flex-wrap">
          <StatCard
            label={t("dashboard.overdue")}
            value={loading ? "…" : overdue}
            hint={overdue > 0 ? "Requires attention" : undefined}
          />
          <StatCard label={t("dashboard.drafts")} value={loading ? "…" : drafts} />
          <StatCard label="This month" value={loading ? "…" : stats.thisMonthCount} />
        </HStack>

        {overdue > 0 ? (
          <Pressable onPress={() => router.push(routes.invoices)}>
            <Card className="border-destructive/30 bg-destructive/5 p-4">
              <HStack space="sm" className="items-center">
                <AlertTriangle size={20} color={icons.destructive} />
                <VStack className="flex-1">
                  <Text className="font-medium text-foreground">
                    {overdue} overdue invoice{overdue > 1 ? "s" : ""}
                  </Text>
                  <Text size="sm" className="text-muted-foreground">
                    Review and send payment reminders from Settings.
                  </Text>
                </VStack>
                <FileText size={18} color={icons.muted} />
              </HStack>
            </Card>
          </Pressable>
        ) : null}

        <VStack space="sm">
          <Text className="font-semibold text-foreground">{t("dashboard.allFeatures")}</Text>
          <Text size="sm" className="text-muted-foreground">
            {t("dashboard.allFeaturesHint")}
          </Text>
          <HStack space="sm" className="flex-wrap">
            {features.map((feature) => (
              <FeatureLinkCard
                key={feature.labelKey}
                icon={feature.icon}
                title={t(feature.labelKey)}
                description={
                  feature.descriptionKey ? t(feature.descriptionKey) : undefined
                }
                onPress={() => router.push(feature.href)}
              />
            ))}
          </HStack>
        </VStack>

        <Button onPress={() => router.push(routes.invoices)}>
          <ButtonText>View all invoices</ButtonText>
        </Button>
      </VStack>
    </ScreenLayout>
  );
}
