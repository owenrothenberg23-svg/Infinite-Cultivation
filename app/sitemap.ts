import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const revalidate = 3600;

type NovelSitemapRow = {
  slug: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://infinitecultivation.com";

  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/library`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/rankings`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/lists`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/copyright`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/dmca`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const admin = supabaseAdmin();
  const pageSize = 1000;
  const novels: NovelSitemapRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("novels")
      .select("slug")
      .not("slug", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Unable to generate novel sitemap:", error.message);
      break;
    }

    const rows = (data as NovelSitemapRow[] | null) ?? [];
    novels.push(...rows);

    if (rows.length < pageSize) break;
  }

  const uniqueSlugs = Array.from(
    new Set(
      novels
        .map((novel) => novel.slug?.trim())
        .filter((slug): slug is string => Boolean(slug))
    )
  );

  const novelPages: MetadataRoute.Sitemap = uniqueSlugs.map((slug) => ({
    url: `${baseUrl}/novel/${encodeURIComponent(slug)}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...novelPages];
}