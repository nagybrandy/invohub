// app/(app)/admin/api-docs.tsx
// Admin-only external API documentation viewer and download.
import * as React from "react";
import { Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { FileDown, FileText } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";
import { getAuthBaseUrl } from "@/lib/auth-url";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

type DocPayload = {
  filename: string;
  content: string;
  updatedAt: string;
};

function downloadMarkdown(filename: string, content: string) {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  void apiFetch(`/api/admin/api-docs?download=1`).catch(() => undefined);
}

export default function AdminApiDocsScreen() {
  const { t } = useTranslation();
  const icons = useIconColors();
  const [doc, setDoc] = React.useState<DocPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<DocPayload>("/api/admin/api-docs");
      setDoc(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documentation.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const baseUrl = getAuthBaseUrl();

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("admin.apiDocsTitle")}
          subtitle={t("admin.apiDocsSubtitle")}
          actions={
            <Button variant="outline" size="sm" onPress={() => router.push(routes.admin)}>
              <ButtonText>{t("admin.apiDocsBack")}</ButtonText>
            </Button>
          }
        />
      }
    >
      <VStack space="md">
        <Card className="border-primary/20 bg-accent/30 p-4">
          <VStack space="sm">
            <HStack space="sm" className="items-center">
              <FileText size={20} color={icons.primary} />
              <Text className="font-semibold text-foreground">
                {t("admin.apiDocsShareHint")}
              </Text>
            </HStack>
            <Text size="sm" className="text-muted-foreground">
              {t("admin.apiDocsShareBody", { baseUrl })}
            </Text>
            <Text size="xs" className="font-mono text-muted-foreground">
              docs/external-api.md
            </Text>
          </VStack>
        </Card>

        <HStack space="sm" className="flex-wrap">
          <Button
            variant="outline"
            onPress={() => {
              if (doc) downloadMarkdown(doc.filename, doc.content);
            }}
            disabled={!doc}
          >
            <HStack space="xs" className="items-center">
              <FileDown size={16} color={icons.foreground} />
              <ButtonText>{t("admin.apiDocsDownload")}</ButtonText>
            </HStack>
          </Button>
          {Platform.OS === "web" && doc ? (
            <Button
              variant="outline"
              onPress={() => {
                const url = `${baseUrl}/api/admin/api-docs?download=1`;
                window.open(url, "_blank");
              }}
            >
              <ButtonText>{t("admin.apiDocsDownloadDirect")}</ButtonText>
            </Button>
          ) : null}
          <Button variant="outline" onPress={() => void load()} disabled={loading}>
            <ButtonText>{t("common.refresh")}</ButtonText>
          </Button>
        </HStack>

        {loading && !doc ? (
          <Text className="text-muted-foreground">{t("common.loading")}</Text>
        ) : null}

        {error ? (
          <Card className="border-destructive/40 bg-destructive/10 p-3">
            <Text size="sm" className="text-destructive">
              {error}
            </Text>
          </Card>
        ) : null}

        {doc ? (
          <Card className="overflow-hidden p-0">
            <ScrollView
              className="max-h-[70vh] p-4"
              nestedScrollEnabled
            >
              <Text
                size="sm"
                className="font-mono leading-relaxed text-foreground"
                selectable
              >
                {doc.content}
              </Text>
            </ScrollView>
          </Card>
        ) : null}
      </VStack>
    </ScreenLayout>
  );
}
