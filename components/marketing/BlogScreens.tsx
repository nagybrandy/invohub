// components/marketing/BlogScreens.tsx
// Blog index and article layouts with semantic headings and internal links.
// Restyled (redesign 2026-11, SPEC §10.6): landing header and footer through
// PublicPage, prose column max 680px, theme tokens. No wording change.
import { router } from "expo-router";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { formatBlogDate } from "@/components/marketing/blog-format";
import { landingLayout, landingType } from "@/components/marketing/landing-theme";
import { PublicPage, proseStyles } from "@/components/marketing/PublicPage";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { BlogPost, BlogPostSummary } from "@/lib/blog/types";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

const focusRing =
  "web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-primary";

/** Navy call-to-action card shared by the index and the article. */
function BlogCta({ testID, withHomeLink }: { testID: string; withHomeLink?: boolean }) {
  const { t } = useTranslation();

  return (
    <Box className="on-navy rounded-dialog bg-navy p-7 tab:p-10">
      <VStack className="gap-4">
        <Heading size="lg" className={landingType.h2OnNavy}>
          {t("blog.ctaTitle")}
        </Heading>
        <Text className="text-base leading-6 text-navy-ink">{t("blog.ctaDescription")}</Text>
        <HStack className="flex-wrap gap-3">
          <Button size="lg" onPress={() => router.push(routes.login)} testID={testID}>
            <ButtonText>{t("landing.getStartedFree")}</ButtonText>
          </Button>
          {withHomeLink ? (
            <Button
              size="lg"
              variant="secondary"
              className="border-white/30 bg-transparent"
              onPress={() => router.replace(routes.home)}
            >
              <ButtonText className="text-white">{t("blog.backHome")}</ButtonText>
            </Button>
          ) : null}
        </HStack>
      </VStack>
    </Box>
  );
}

export function BlogIndexScreen({ posts }: { posts: BlogPostSummary[] }) {
  const { t, i18n } = useTranslation();
  const icons = useIconColors();

  return (
    <PublicPage testID="blog-index-page">
      <Box className={`${landingLayout.container} py-10 tab:py-14`}>
        <VStack className="gap-10">
          <VStack className="max-w-[680px] gap-3">
            <Text className={landingType.eyebrow}>{t("blog.eyebrow")}</Text>
            <Heading className={proseStyles.h1}>{t("blog.indexTitle")}</Heading>
            <Text className={landingType.lead}>{t("blog.indexSubtitle")}</Text>
          </VStack>

          <Box className="gap-4">
            {posts.map((post) => (
              <Pressable
                key={post.slug}
                accessibilityRole="link"
                onPress={() => router.push(routes.blogPost(post.slug))}
                className={`min-w-0 rounded-card bg-surface p-5 shadow-card web:transition-shadow web:duration-150 web:hover:shadow-menu tab:p-6 ${focusRing}`}
                testID={`blog-card-${post.slug}`}
              >
                <VStack className="gap-2">
                  <HStack className="items-center gap-3">
                    <Text className="text-xs text-muted-ink">
                      {formatBlogDate(post.publishedAt, i18n.language)}
                    </Text>
                    <HStack className="items-center gap-1">
                      <Clock3 size={13} color={icons.muted} />
                      <Text className="text-xs text-muted-ink">
                        {t("blog.readingMinutes", { count: post.readingMinutes })}
                      </Text>
                    </HStack>
                  </HStack>
                  <Heading size="md" className={landingType.cardTitle}>
                    {post.title}
                  </Heading>
                  <Text className={landingType.cardBody}>{post.description}</Text>
                  <HStack className="items-center gap-1 pt-1">
                    <Text className="text-sm font-medium text-primary">
                      {t("blog.readArticle")}
                    </Text>
                    <ArrowRight size={16} color={icons.primary} />
                  </HStack>
                </VStack>
              </Pressable>
            ))}
          </Box>

          <BlogCta testID="blog-index-cta" withHomeLink />
        </VStack>
      </Box>
    </PublicPage>
  );
}

export function BlogArticleScreen({
  post,
  related,
}: {
  post: BlogPost;
  related: BlogPostSummary[];
}) {
  const { t, i18n } = useTranslation();
  const icons = useIconColors();

  return (
    <PublicPage testID="blog-article-page">
      <VStack className={`${proseStyles.column} gap-8`}>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(routes.blog)}
          testID="blog-back-to-index"
          className={`min-h-10 justify-center self-start rounded-control ${focusRing}`}
        >
          <HStack className="items-center gap-2">
            <ArrowLeft size={18} color={icons.primary} />
            <Text className="text-sm font-medium text-primary">{t("blog.allArticles")}</Text>
          </HStack>
        </Pressable>

        <VStack className="gap-3">
          <Text className={landingType.eyebrow}>{t("blog.eyebrow")}</Text>
          <Box testID="blog-article-title">
            <Heading className={proseStyles.h1}>{post.title}</Heading>
          </Box>
          <HStack className="flex-wrap items-center gap-3">
            <Text className={proseStyles.meta}>
              {formatBlogDate(post.publishedAt, i18n.language)}
            </Text>
            <Text className={proseStyles.meta}>
              {t("blog.readingMinutes", { count: post.readingMinutes })}
            </Text>
          </HStack>
          <Text className="text-lg leading-[1.6] text-muted-ink">{post.description}</Text>
        </VStack>

        {post.sections.map((section) => (
          <VStack key={section.heading} className="gap-3">
            <Heading size="xl" className={proseStyles.h2}>
              {section.heading}
            </Heading>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph.slice(0, 24)} className={proseStyles.body}>
                {paragraph}
              </Text>
            ))}
          </VStack>
        ))}

        {related.length > 0 ? (
          <VStack className="gap-3 pt-4">
            <Heading size="lg" className={proseStyles.h2}>
              {t("blog.related")}
            </Heading>
            {related.map((item) => (
              <Pressable
                key={item.slug}
                accessibilityRole="link"
                onPress={() => router.push(routes.blogPost(item.slug))}
                className={`rounded-card bg-surface p-4 shadow-card ${focusRing}`}
                testID={`blog-related-${item.slug}`}
              >
                <Text className={landingType.cardTitle}>{item.title}</Text>
                <Text className={`mt-1 ${landingType.cardBody}`}>{item.description}</Text>
              </Pressable>
            ))}
          </VStack>
        ) : null}

        <BlogCta testID="blog-article-cta" />
      </VStack>
    </PublicPage>
  );
}
