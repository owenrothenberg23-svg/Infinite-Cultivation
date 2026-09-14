export type DiscoveryCategory = {
  slug: string;
  label: string;

  /**
   * Values that may appear as primary_genre.
   */
  primaryGenres: string[];

  /**
   * Values that may appear inside novels.tags.
   */
  tags: string[];
};

/**
 * Public-facing discovery taxonomy.
 *
 * IMPORTANT:
 * This does NOT rewrite imported novel metadata.
 *
 * It simply tells the discovery/ranking layer which imported
 * primary genres and tags belong to each browsable category.
 */
export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  {
    slug: "xianxia",
    label: "Xianxia",
    primaryGenres: ["xianxia"],
    tags: ["xianxia"],
  },

  {
    slug: "xuanhuan",
    label: "Xuanhuan",
    primaryGenres: ["xuanhuan"],
    tags: ["xuanhuan"],
  },

  {
    slug: "wuxia",
    label: "Wuxia",
    primaryGenres: ["wuxia"],
    tags: ["wuxia"],
  },

  {
    slug: "cultivation",
    label: "Cultivation",
    primaryGenres: [
      "xianxia",
      "xuanhuan",
      "wuxia",
      "eastern",
      "eastern_fantasy",
    ],
    tags: [
      "cultivation",
    ],
  },

  {
    slug: "progression-fantasy",
    label: "Progression Fantasy",
    primaryGenres: [
      "progression_fantasy",
    ],
    tags: [
      "progression_fantasy",
      "progression fantasy",
    ],
  },

  {
    slug: "litrpg",
    label: "LitRPG",
    primaryGenres: [
      "litrpg",
      "game",
    ],
    tags: [
      "litrpg",
      "game_elements",
      "level_system",
    ],
  },

  {
    slug: "fantasy",
    label: "Fantasy",
    primaryGenres: [
      "fantasy",
    ],
    tags: [
      "fantasy",
    ],
  },

  {
    slug: "eastern-fantasy",
    label: "Eastern Fantasy",
    primaryGenres: [
      "eastern",
      "eastern_fantasy",
    ],
    tags: [
      "eastern",
      "eastern_fantasy",
    ],
  },

  {
    slug: "action",
    label: "Action",
    primaryGenres: [
      "action",
      "action_adventure",
    ],
    tags: [
      "action",
    ],
  },

  {
    slug: "adventure",
    label: "Adventure",
    primaryGenres: [
      "adventure",
      "action_adventure",
    ],
    tags: [
      "adventure",
    ],
  },

  {
    slug: "martial-arts",
    label: "Martial Arts",
    primaryGenres: [
      "wuxia",
    ],
    tags: [
      "martial_arts",
    ],
  },

  {
    slug: "system",
    label: "System",
    primaryGenres: [],
    tags: [
      "system",
      "level_system",
      "game_elements",
    ],
  },

  {
    slug: "romance",
    label: "Romance",
    primaryGenres: [
      "romance",
    ],
    tags: [
      "romance",
    ],
  },

  {
    slug: "mystery",
    label: "Mystery",
    primaryGenres: [
      "mystery",
    ],
    tags: [
      "mystery",
    ],
  },

  {
    slug: "sci-fi",
    label: "Sci-Fi",
    primaryGenres: [
      "sci_fantasy",
      "sci-fi",
      "science_fiction",
    ],
    tags: [
      "sci-fi",
      "sci_fi",
      "science_fiction",
    ],
  },

  {
    slug: "horror",
    label: "Horror",
    primaryGenres: [
      "horror",
    ],
    tags: [
      "horror",
    ],
  },

  {
    slug: "fan-fiction",
    label: "Fan Fiction",
    primaryGenres: [
      "fan-fiction",
      "fan_fiction",
      "fanfiction",
    ],
    tags: [
      "fan-fiction",
      "fan_fiction",
      "fanfiction",
    ],
  },
];

export function getDiscoveryCategory(
  slug: string | null | undefined
) {
  if (!slug) {
    return null;
  }

  return (
    DISCOVERY_CATEGORIES.find(
      (category) => category.slug === slug
    ) ?? null
  );
}

/**
 * Useful for client-side filtering, testing, and future Library
 * components.
 */
export function novelMatchesDiscoveryCategory(
  novel: {
    primary_genre?: string | null;
    tags?: string[] | null;
  },
  category: DiscoveryCategory
) {
  const primaryGenre =
    novel.primary_genre?.trim().toLowerCase() || "";

  const tags = new Set(
    (novel.tags || []).map((tag) =>
      tag.trim().toLowerCase()
    )
  );

  if (
    primaryGenre &&
    category.primaryGenres.includes(primaryGenre)
  ) {
    return true;
  }

  return category.tags.some((tag) =>
    tags.has(tag.toLowerCase())
  );
}