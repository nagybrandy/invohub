// app/blog/[slug].tsx
// Individual blog article route resolved from the typed static catalog.
import { Redirect, useLocalSearchParams } from "expo-router";
import { BlogArticleScreen } from "@/components/marketing/BlogScreens";
import { SeoHead } from "@/components/marketing/SeoHead";
import { getBlogPostBySlug, getRelatedBlogPosts } from "@/lib/blog";
import {
  buildBlogPostingJsonLd,
  buildOrganizationJsonLd,
  buildPageSeo,
} from "@/lib/seo";

export default function BlogArticleRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const resolvedSlug = Array.isArray(slug) ? slug[0] : slug;
  const post = resolvedSlug ? getBlogPostBySlug(resolvedSlug) : undefined;

  if (!post) {
    return <Redirect href="/blog" />;
  }

  const related = getRelatedBlogPosts(post.slug);
  const path = `/blog/${post.slug}`;
  const seo = buildPageSeo({
    title: post.title,
    description: post.description,
    path,
    type: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
  });

  return (
    <>
      <SeoHead
        seo={seo}
        jsonLd={[
          buildOrganizationJsonLd(),
          buildBlogPostingJsonLd({
            title: post.title,
            description: post.description,
            path,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt ?? post.publishedAt,
          }),
        ]}
      />
      <BlogArticleScreen post={post} related={related} />
    </>
  );
}
