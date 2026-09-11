// app/blog/index.tsx
// Public blog index route listing Hungarian InvoHub articles.
import { BlogIndexScreen } from "@/components/marketing/BlogScreens";
import { SeoHead } from "@/components/marketing/SeoHead";
import { listBlogPosts } from "@/lib/blog";
import {
  buildOrganizationJsonLd,
  buildPageSeo,
  buildSoftwareApplicationJsonLd,
} from "@/lib/seo";

export default function BlogIndexRoute() {
  const posts = listBlogPosts();
  const seo = buildPageSeo({
    title: "Blog",
    description:
      "Magyar számlázási útmutatók az InvoHubtól: alapok, PDF/e-mail küldés, emlékeztetők, törzsadatok és a tervezett funkciók átlátható listája.",
    path: "/blog",
  });

  return (
    <>
      <SeoHead
        seo={seo}
        jsonLd={[buildOrganizationJsonLd(), buildSoftwareApplicationJsonLd()]}
      />
      <BlogIndexScreen posts={posts} />
    </>
  );
}
