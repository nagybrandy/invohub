// components/marketing/BlogScreens.tsx
// Blog index and article layouts with semantic headings and internal links.
import { router } from "expo-router";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react-native";
import { ScrollView, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { landingColors, landingDisplayType } from "@/components/marketing/landing-theme";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useSession } from "@/lib/auth-client";
import type { BlogPost, BlogPostSummary } from "@/lib/blog/types";
import { routes } from "@/lib/navigation";

/**
 * Full marketing nav (same component as the homepage) reused on the blog so
 * articles never ship with a stripped-down header. `onNavigate` (the
 * section-scroll callback) can't scroll a section on the CURRENT page from
 * here — there is none — so it takes the reader home instead; landing on
 * the top of the homepage from any blog nav link is a reasonable fallback
 * on this screen, not a bug.
 */
function useBlogHeaderProps() {
  const { width } = useWindowDimensions();
  const { data: session } = useSession();
  const isDesktop = width >= 768;
  const isSignedIn = Boolean(session);

  return {
    isDesktop,
    isSignedIn,
    forceSolid: true,
    onNavigate: () => router.push(routes.home),
    onLogin: () => router.push(routes.login),
    onPrimaryAction: () => router.push(isSignedIn ? routes.dashboard : routes.login),
    onOpenBlog: () => router.push(routes.blog),
  };
}

function formatDate(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale.startsWith("hu") ? "hu-HU" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function BlogIndexScreen({ posts }: { posts: BlogPostSummary[] }) {
  const { t, i18n } = useTranslation();
  const headerProps = useBlogHeaderProps();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <LandingHeader {...headerProps} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-16"
        testID="blog-index-page"
      >
        <Box className="bg-secondary px-4 pb-14 pt-28 md:px-8 md:pb-20 md:pt-32">
          <VStack className="mx-auto w-full max-w-[960px]" space="md">
            <Text className={`${landingDisplayType.kicker} text-[#b9c9e8]`}>
              {t("blog.eyebrow")}
            </Text>
            <Heading className="font-heading text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              {t("blog.indexTitle")}
            </Heading>
            <Text className="max-w-[640px] font-light leading-7 text-[#c8d2e6]">
              {t("blog.indexSubtitle")}
            </Text>
          </VStack>
        </Box>

        <Box className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-8 md:py-14">
          <VStack space="lg">
            {posts.map((post) => (
              <Pressable
                key={post.slug}
                accessibilityRole="link"
                onPress={() => router.push(routes.blogPost(post.slug))}
                className="rounded-marketing border border-[#dce3ef] bg-white p-5 web:transition-[transform,box-shadow,border-color] web:duration-200 web:hover:-translate-y-0.5 web:hover:border-primary/40 web:hover:shadow-lg md:p-7"
                testID={`blog-card-${post.slug}`}
              >
                <VStack space="sm">
                  <HStack className="items-center gap-3">
                    <Text size="xs" className="font-medium text-secondary">
                      {formatDate(post.publishedAt, i18n.language)}
                    </Text>
                    <HStack space="xs" className="items-center">
                      <Clock3 size={14} color={landingColors.muted} />
                      <Text size="xs" className="text-muted-foreground">
                        {t("blog.readingMinutes", { count: post.readingMinutes })}
                      </Text>
                    </HStack>
                  </HStack>
                  <Heading size="xl" className="text-secondary">
                    {post.title}
                  </Heading>
                  <Text className="font-light leading-7 text-muted-foreground">
                    {post.description}
                  </Text>
                  <HStack space="xs" className="items-center pt-1">
                    <Text size="sm" className="font-medium text-secondary">
                      {t("blog.readArticle")}
                    </Text>
                    <ArrowRight size={16} color={landingColors.cornflower} />
                  </HStack>
                </VStack>
              </Pressable>
            ))}
          </VStack>

          <Box className="mt-12 rounded-marketing bg-secondary p-6 md:p-8">
            <VStack space="md">
              <Heading size="lg" className="text-white">
                {t("blog.ctaTitle")}
              </Heading>
              <Text className="font-light leading-7 text-[#c8d2e6]">
                {t("blog.ctaDescription")}
              </Text>
              <HStack className="flex-wrap gap-3">
                <Button onPress={() => router.push(routes.login)} testID="blog-index-cta">
                  <ButtonText>{t("landing.getStartedFree")}</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  className="border-white/30 bg-transparent"
                  onPress={() => router.replace(routes.home)}
                >
                  <ButtonText className="text-white">{t("blog.backHome")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Box>
        </Box>
      </ScrollView>
    </SafeAreaView>
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
  const headerProps = useBlogHeaderProps();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <LandingHeader {...headerProps} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-16"
        testID="blog-article-page"
      >
        <Box className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-28 md:px-8 md:pb-14 md:pt-32">
          <VStack space="lg">
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(routes.blog)}
              testID="blog-back-to-index"
              className="self-start"
            >
              <HStack space="sm" className="items-center">
                <ArrowLeft size={18} color={landingColors.cornflower} />
                <Text className="font-medium text-secondary">{t("blog.allArticles")}</Text>
              </HStack>
            </Pressable>

            <VStack space="sm">
              <Text className={`${landingDisplayType.kicker} text-secondary`}>
                {t("blog.eyebrow")}
              </Text>
              <Box testID="blog-article-title">
                <Heading className="font-heading text-3xl font-bold leading-tight tracking-tight text-secondary md:text-4xl">
                  {post.title}
                </Heading>
              </Box>
              <HStack className="flex-wrap items-center gap-3">
                <Text size="sm" className="text-muted-foreground">
                  {formatDate(post.publishedAt, i18n.language)}
                </Text>
                <Text size="sm" className="text-muted-foreground">
                  {t("blog.readingMinutes", { count: post.readingMinutes })}
                </Text>
              </HStack>
              <Text className="font-light leading-7 text-muted-foreground md:text-lg">
                {post.description}
              </Text>
            </VStack>

            {post.sections.map((section) => (
              <VStack key={section.heading} space="sm">
                <Heading size="xl" className="text-secondary">
                  {section.heading}
                </Heading>
                {section.paragraphs.map((paragraph) => (
                  <Text
                    key={paragraph.slice(0, 24)}
                    className="font-light leading-7 text-muted-foreground"
                  >
                    {paragraph}
                  </Text>
                ))}
              </VStack>
            ))}

            {related.length > 0 ? (
              <VStack space="md" className="pt-4">
                <Heading size="lg" className="text-secondary">
                  {t("blog.related")}
                </Heading>
                {related.map((item) => (
                  <Pressable
                    key={item.slug}
                    accessibilityRole="link"
                    onPress={() => router.push(routes.blogPost(item.slug))}
                    className="rounded-2xl border border-[#dce3ef] bg-[#edf2fa] p-4"
                    testID={`blog-related-${item.slug}`}
                  >
                    <Text className="font-semibold text-secondary">{item.title}</Text>
                    <Text size="sm" className="mt-1 font-light text-muted-foreground">
                      {item.description}
                    </Text>
                  </Pressable>
                ))}
              </VStack>
            ) : null}

            <Box className="rounded-marketing bg-secondary p-6">
              <VStack space="md">
                <Heading size="lg" className="text-white">
                  {t("blog.ctaTitle")}
                </Heading>
                <Text className="font-light leading-7 text-[#c8d2e6]">
                  {t("blog.ctaDescription")}
                </Text>
                <Button
                  className="self-start"
                  onPress={() => router.push(routes.login)}
                  testID="blog-article-cta"
                >
                  <ButtonText>{t("landing.getStartedFree")}</ButtonText>
                  <ArrowRight size={16} color={landingColors.white} />
                </Button>
              </VStack>
            </Box>
          </VStack>
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}
