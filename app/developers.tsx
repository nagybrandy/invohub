// app/developers.tsx
// Public developer documentation for the external /api/v1 API (no auth).
import { useTranslation } from "react-i18next";
import { DeveloperDocsScreen } from "@/components/marketing/DeveloperDocs";
import { SeoHead } from "@/components/marketing/SeoHead";
import { routes } from "@/lib/navigation";
import { buildPageSeo } from "@/lib/seo";

export default function DevelopersRoute() {
  const { t } = useTranslation();
  const seo = buildPageSeo({
    title: t("developers.meta.title"),
    description: t("developers.meta.description"),
    path: routes.developers as string,
  });

  return (
    <>
      <SeoHead seo={seo} />
      <DeveloperDocsScreen />
    </>
  );
}
