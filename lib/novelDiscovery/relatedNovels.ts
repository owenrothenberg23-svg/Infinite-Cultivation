import {
  DISCOVERY_CATEGORIES,
  novelMatchesDiscoveryCategory,
} from "@/lib/novelDiscovery/taxonomy";

export type SimilarityNovel = {
  id: string;
  slug: string;
  title: string;
  author_name: string | null;
  cover_image_url: string | null;
  avg_rating: number | null;
  rating_count?: number | null;
  view_count?: number | null;
  primary_genre: string | null;
  tags: string[] | null;
  country?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizedTags(tags: string[] | null | undefined) {
  return new Set((tags || []).map(normalize).filter(Boolean));
}

function categoriesFor(novel: SimilarityNovel) {
  return DISCOVERY_CATEGORIES.filter((category) =>
    novelMatchesDiscoveryCategory(novel, category)
  ).map((category) => category.slug);
}

export function scoreRelatedNovel(
  source: SimilarityNovel,
  candidate: SimilarityNovel
) {
  if (source.id === candidate.id) return Number.NEGATIVE_INFINITY;

  let score = 0;

  const sourceGenre = normalize(source.primary_genre);
  const candidateGenre = normalize(candidate.primary_genre);

  if (sourceGenre && sourceGenre === candidateGenre) {
    score += 28;
  }

  const sourceCategories = new Set(categoriesFor(source));
  const candidateCategories = categoriesFor(candidate);
  const sharedCategories = candidateCategories.filter((category) =>
    sourceCategories.has(category)
  );

  score += Math.min(sharedCategories.length, 3) * 14;

  const sourceTags = normalizedTags(source.tags);
  const candidateTags = normalizedTags(candidate.tags);

  let sharedTags = 0;
  for (const tag of candidateTags) {
    if (sourceTags.has(tag)) sharedTags += 1;
  }

  score += Math.min(sharedTags, 6) * 8;

  if (
    source.country &&
    candidate.country &&
    normalize(source.country) === normalize(candidate.country)
  ) {
    score += 2;
  }

  // Quality/popularity are deliberately weak tie-breakers.
  if (typeof candidate.avg_rating === "number" && candidate.avg_rating > 0) {
    score += Math.min(candidate.avg_rating, 5) * 0.5;
  }

  if (typeof candidate.rating_count === "number" && candidate.rating_count > 0) {
    score += Math.min(Math.log10(candidate.rating_count + 1), 3) * 0.4;
  }

  if (typeof candidate.view_count === "number" && candidate.view_count > 0) {
    score += Math.min(Math.log10(candidate.view_count + 1), 5) * 0.15;
  }

  return score;
}

export function rankRelatedNovels(
  source: SimilarityNovel,
  candidates: SimilarityNovel[],
  limit = 8
) {
  return candidates
    .map((novel) => ({
      novel,
      score: scoreRelatedNovel(source, novel),
    }))
    // Require at least one meaningful genre/category/tag signal.
    .filter((item) => item.score >= 8)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const ratingDiff =
        (b.novel.avg_rating ?? 0) - (a.novel.avg_rating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;

      return a.novel.title.localeCompare(b.novel.title);
    })
    .slice(0, limit);
}