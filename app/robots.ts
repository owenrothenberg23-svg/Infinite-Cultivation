// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://infinitecultivation.com";

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/library",
        "/rankings",
        "/novel/",
        "/lists",
        "/list/",
        "/user/",
        "/copyright",
        "/dmca",
      ],
      disallow: [
        "/account",
        "/admin/",
        "/api/",
        "/beta",
        "/create-list",
        "/dashboard",
        "/import",
        "/login",
        "/new",
        "/read/",
        "/store",
        "/titles",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}