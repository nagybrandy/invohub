// lib/blog/index.test.ts
import {
  getAllBlogSlugs,
  getBlogPostBySlug,
  getRelatedBlogPosts,
  listBlogPosts,
} from "@/lib/blog";

describe("blog catalog", () => {
  it("lists posts newest first with required summary fields", () => {
    const posts = listBlogPosts();
    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts.length).toBeLessThanOrEqual(8);

    for (let i = 1; i < posts.length; i += 1) {
      expect(posts[i - 1].publishedAt >= posts[i].publishedAt).toBe(true);
    }

    expect(posts[0]).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        publishedAt: expect.any(String),
        readingMinutes: expect.any(Number),
        tags: expect.any(Array),
      }),
    );
  });

  it("resolves posts by slug and returns undefined for unknown slugs", () => {
    const slug = getAllBlogSlugs()[0];
    const post = getBlogPostBySlug(slug);
    expect(post?.slug).toBe(slug);
    expect(post?.sections.length).toBeGreaterThan(0);
    expect(post?.sections[0].heading.length).toBeGreaterThan(0);
    expect(post?.sections[0].paragraphs[0].length).toBeGreaterThan(40);

    expect(getBlogPostBySlug("does-not-exist")).toBeUndefined();
  });

  it("returns related posts excluding the current slug", () => {
    const slug = "magyar-szamlazas-alapok";
    const related = getRelatedBlogPosts(slug, 3);
    expect(related).toHaveLength(3);
    expect(related.every((post) => post.slug !== slug)).toBe(true);
  });

  it("covers the required Hungarian invoicing topics", () => {
    const slugs = getAllBlogSlugs();
    expect(slugs).toEqual(
      expect.arrayContaining([
        "magyar-szamlazas-alapok",
        "pdf-es-email-szamlakuldes",
        "fizetesi-emlekeztetok",
        "partner-es-termek-torzsadatok",
        "elerheto-es-tervezett-funkciok",
      ]),
    );

    const roadmap = getBlogPostBySlug("elerheto-es-tervezett-funkciok");
    const body = roadmap?.sections.map((s) => s.paragraphs.join(" ")).join(" ") ?? "";
    expect(body).toMatch(/tervezett/i);
    expect(body).toMatch(/banki párosítás/i);
    expect(body).toMatch(/EV adókalkulátor|adókalkulátor/i);
    expect(body).toMatch(/M2M/i);
  });
});
