// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://infinite-cultivation-28ue.vercel.app";

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
