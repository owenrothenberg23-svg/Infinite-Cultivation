export type RankingNovel = {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  primary_genre: string | null;
  tags: string[] | null;
  status: string | null;
  chapters_total: number | null;
  created_at: string;

  avg_rating: number | null;
  rating_count: number | null;
  view_count: number | null;

  sources?: RankingSource[] | null;
};

export type RankingSource = {
  source_site: string;
  external_rating: number | null;
  external_rating_count: number | null;
  external_review_count: number | null;
};

export type RankedNovel = RankingNovel & {
  ranking: {
    quality_score: number;
    popularity_score: number;
    overall_score: number;

    external_rating: number | null;
    external_rating_count: number;
    external_review_count: number;

    source_count: number;
  };
};

type SourceProfile = {
  ratingPrior: number;
  ratingConfidence: number;
  popularityScale: number;
};

const SOURCE_PROFILES: Record<string, SourceProfile> = {
  "novelbuddy.me": {
    ratingPrior: 4.864,
    ratingConfidence: 12,
    popularityScale: 60,
  },

  "novelcool.com": {
    ratingPrior: 4.406,
    ratingConfidence: 40,
    popularityScale: 3500,
  },

  "royalroad.com": {
    ratingPrior: 4.488,
    ratingConfidence: 100,
    popularityScale: 15000,
  },

  "mtlnovel.me": {
    ratingPrior: 4.3,
    ratingConfidence: 20,
    popularityScale: 100,
  },
};

const DEFAULT_PROFILE: SourceProfile = {
  ratingPrior: 4.5,
  ratingConfidence: 25,
  popularityScale: 1000,
};

function clamp(
  value: number,
  min = 0,
  max = 1
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function finiteOrZero(
  value: number | null | undefined
) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function getProfile(
  sourceSite: string
) {
  return (
    SOURCE_PROFILES[
      sourceSite.toLowerCase()
    ] || DEFAULT_PROFILE
  );
}

function bayesianRating(
  rating: number,
  count: number,
  profile: SourceProfile
) {
  if (count <= 0) {
    return profile.ratingPrior;
  }

  return (
    count * rating +
    profile.ratingConfidence *
      profile.ratingPrior
  ) /
    (count +
      profile.ratingConfidence);
}

function sourceQualityScore(
  source: RankingSource
) {
  const rating =
    finiteOrZero(
      source.external_rating
    );

  const count =
    finiteOrZero(
      source.external_rating_count
    );

  if (
    rating <= 0 ||
    count <= 0
  ) {
    return null;
  }

  const profile =
    getProfile(
      source.source_site
    );

  const adjusted =
    bayesianRating(
      rating,
      count,
      profile
    );

  return clamp(
    adjusted / 5
  );
}

function sourcePopularityScore(
  source: RankingSource
) {
  const ratingCount =
    finiteOrZero(
      source.external_rating_count
    );

  const reviewCount =
    finiteOrZero(
      source.external_review_count
    );

  const profile =
    getProfile(
      source.source_site
    );

  /*
   * Normalize popularity inside
   * each source's ecosystem.
   *
   * log1p prevents huge counts
   * from dominating.
   */
  const ratingSignal =
    Math.log1p(ratingCount) /
    Math.log1p(
      profile.popularityScale
    );

  const reviewSignal =
    Math.log1p(reviewCount) /
    Math.log1p(50);

  return clamp(
    ratingSignal * 0.9 +
      reviewSignal * 0.1
  );
}

function nativeQualityScore(
  novel: RankingNovel
) {
  const rating =
    finiteOrZero(
      novel.avg_rating
    );

  const count =
    finiteOrZero(
      novel.rating_count
    );

  if (
    rating <= 0 ||
    count <= 0
  ) {
    return null;
  }

  /*
   * IC ratings eventually become
   * extremely important, but use
   * a neutral prior while the
   * platform is young.
   */
  const adjusted =
    (
      count * rating +
      10 * 4.25
    ) /
    (count + 10);

  return clamp(
    adjusted / 5
  );
}

function nativePopularityScore(
  novel: RankingNovel
) {
  const views =
    finiteOrZero(
      novel.view_count
    );

  /*
   * Native popularity is intentionally
   * conservative until IC has meaningful
   * traffic.
   */
  return clamp(
    Math.log1p(views) /
      Math.log1p(10_000)
  );
}

export function scoreNovel(
  novel: RankingNovel
): RankedNovel {
  const sources =
    novel.sources || [];

  const qualityScores =
    sources
      .map(sourceQualityScore)
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  const popularityScores =
    sources.map(
      sourcePopularityScore
    );

  const externalQuality =
    qualityScores.length
      ? qualityScores.reduce(
          (sum, score) =>
            sum + score,
          0
        ) /
        qualityScores.length
      : 0;

  /*
   * For popularity, use the strongest
   * source rather than averaging.
   *
   * A novel should not be penalized
   * simply because it only exists on
   * one source.
   */
  const externalPopularity =
    popularityScores.length
      ? Math.max(
          ...popularityScores
        )
      : 0;

  const nativeQuality =
    nativeQualityScore(novel);

  const nativePopularity =
    nativePopularityScore(
      novel
    );

  /*
   * Native IC data receives increasing
   * influence once enough ratings exist.
   */
  const nativeRatingCount =
    finiteOrZero(
      novel.rating_count
    );

  const nativeQualityWeight =
    nativeQuality === null
      ? 0
      : clamp(
          nativeRatingCount / 25
        ) * 0.5;

  const qualityScore =
    nativeQuality === null
      ? externalQuality
      : externalQuality *
          (1 -
            nativeQualityWeight) +
        nativeQuality *
          nativeQualityWeight;

  /*
   * IC popularity starts as a supporting
   * signal. External popularity remains
   * useful during bootstrap.
   */
  const popularityScore =
    externalPopularity * 0.9 +
    nativePopularity * 0.1;

  /*
   * Overall favors quality, but requires
   * some evidence that readers actually
   * engage with the novel.
   */
  const overallScore =
    qualityScore * 0.65 +
    popularityScore * 0.35;

  const externalRatingCounts =
    sources.map((source) =>
      finiteOrZero(
        source.external_rating_count
      )
    );

  const externalReviewCounts =
    sources.map((source) =>
      finiteOrZero(
        source.external_review_count
      )
    );

  const weightedRatingNumerator =
    sources.reduce(
      (sum, source) => {
        const rating =
          finiteOrZero(
            source.external_rating
          );

        const count =
          finiteOrZero(
            source.external_rating_count
          );

        return (
          sum +
          rating * count
        );
      },
      0
    );

  const totalRatingCount =
    externalRatingCounts.reduce(
      (sum, count) =>
        sum + count,
      0
    );

  return {
    ...novel,

    ranking: {
      quality_score:
        qualityScore,

      popularity_score:
        popularityScore,

      overall_score:
        overallScore,

      external_rating:
        totalRatingCount > 0
          ? weightedRatingNumerator /
            totalRatingCount
          : null,

      external_rating_count:
        totalRatingCount,

      external_review_count:
        externalReviewCounts.reduce(
          (sum, count) =>
            sum + count,
          0
        ),

      source_count:
        sources.length,
    },
  };
}

export function rankNovels(
  novels: RankingNovel[],
  mode:
    | "top"
    | "popular"
    | "new" = "top"
) {
  const scored =
    novels.map(scoreNovel);

  if (mode === "new") {
    return scored.sort(
      (a, b) =>
        new Date(
          b.created_at
        ).getTime() -
        new Date(
          a.created_at
        ).getTime()
    );
  }

  if (mode === "popular") {
    return scored.sort(
      (a, b) =>
        b.ranking
          .popularity_score -
        a.ranking
          .popularity_score
    );
  }

  return scored.sort(
    (a, b) =>
      b.ranking.overall_score -
      a.ranking.overall_score
  );
}