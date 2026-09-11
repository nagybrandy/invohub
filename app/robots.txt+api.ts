// app/robots.txt+api.ts
// robots.txt for crawlers on the marketing host.
import { buildRobotsTxt } from "@/lib/seo";

export async function GET() {
  return new Response(buildRobotsTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
