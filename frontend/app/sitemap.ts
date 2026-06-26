import type { MetadataRoute } from "next";
import { getPosts } from "../lib/api";
import { absoluteUrl } from "../lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts();

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: absoluteUrl("/blog"),
      changeFrequency: "daily",
      priority: 0.9
    },
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.publishedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}
