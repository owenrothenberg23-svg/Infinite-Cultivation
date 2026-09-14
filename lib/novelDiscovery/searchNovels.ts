// lib/novelDiscovery/searchNovels.ts

export type SearchableNovel = {
  id: string | number;
  title: string;
  author_name?: string | null;
  synopsis?: string | null;
  primary_genre?: string | null;
  tags?: string[] | null;
};

export type NovelSearchResult<T extends SearchableNovel> = {
  novel: T;
  score: number;
  matched_on: NovelSearchMatch[];
};

export type NovelSearchMatch =
  | "exact_title"
  | "title_prefix"
  | "title"
  | "author"
  | "genre"
  | "tag"
  | "synopsis"
  | "fuzzy_title";

export type SearchNovelsOptions = {
  limit?: number;
  minimumScore?: number;
};

const DEFAULT_LIMIT = 100;
const DEFAULT_MINIMUM_SCORE = 20;

/*
 * Convert text into a predictable representation for matching.
 *
 * Example:
 *
 * "Lord of the Mysteries!"
 * ->
 * "lord of the mysteries"
 */
function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}

/*
 * Very small words generally create noisy search matches.
 *
 * We still keep them for exact-title matching, but ignore them
 * when determining whether individual query words matched.
 */
function meaningfulTokens(value: string) {
  return tokenize(value).filter(
    (token) => token.length >= 2
  );
}

/*
 * Levenshtein distance.
 *
 * Used only for short title/query comparisons so typo tolerance
 * remains inexpensive.
 */
function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );

  const current = new Array<number>(
    b.length + 1
  );

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost =
        a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function fuzzySimilarity(a: string, b: string) {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (!left || !right) return 0;

  const longest = Math.max(
    left.length,
    right.length
  );

  if (longest === 0) return 1;

  const distance = levenshteinDistance(
    left,
    right
  );

  return 1 - distance / longest;
}

/*
 * Check whether every meaningful query word appears somewhere
 * in a field.
 */
function allTokensMatch(
  field: string,
  queryTokens: string[]
) {
  const normalizedField =
    normalizeText(field);

  if (!normalizedField) {
    return false;
  }

  return queryTokens.every((token) =>
    normalizedField.includes(token)
  );
}

function addMatch(
  matches: Set<NovelSearchMatch>,
  match: NovelSearchMatch
) {
  matches.add(match);
}

function scoreNovel<T extends SearchableNovel>(
  novel: T,
  rawQuery: string
): NovelSearchResult<T> | null {
  const query = normalizeText(rawQuery);

  if (!query) {
    return {
      novel,
      score: 0,
      matched_on: [],
    };
  }

  const queryTokens =
    meaningfulTokens(query);

  const title =
    normalizeText(novel.title);

  const author =
    normalizeText(
      novel.author_name
    );

  const synopsis =
    normalizeText(
      novel.synopsis
    );

  const genre =
    normalizeText(
      novel.primary_genre
    );

  const tags = (
    novel.tags || []
  )
    .map(normalizeText)
    .filter(Boolean);

  let score = 0;

  const matches =
    new Set<NovelSearchMatch>();

  /*
   * -----------------------------------------------------------
   * TITLE
   * -----------------------------------------------------------
   *
   * Title matches are intentionally much stronger than anything
   * else.
   */

  if (title === query) {
    score += 1000;
    addMatch(
      matches,
      "exact_title"
    );
  } else {
    if (title.startsWith(query)) {
      score += 500;
      addMatch(
        matches,
        "title_prefix"
      );
    }

    if (title.includes(query)) {
      score += 350;
      addMatch(
        matches,
        "title"
      );
    }

    if (
      queryTokens.length > 0 &&
      allTokensMatch(
        title,
        queryTokens
      )
    ) {
      score += 250;
      addMatch(
        matches,
        "title"
      );
    }
  }

  /*
   * Individual title words.
   *
   * This helps queries such as:
   *
   * "lord mysteries"
   *
   * find:
   *
   * "Lord of the Mysteries"
   */
  if (
    queryTokens.length > 0
  ) {
    const titleTokens =
      tokenize(title);

    let matchingTitleTokens = 0;

    for (const queryToken of queryTokens) {
      if (
        titleTokens.some(
          (titleToken) =>
            titleToken === queryToken
        )
      ) {
        matchingTitleTokens += 1;
      }
    }

    if (matchingTitleTokens > 0) {
      score +=
        matchingTitleTokens * 70;

      addMatch(
        matches,
        "title"
      );
    }
  }

  /*
   * -----------------------------------------------------------
   * TYPO-TOLERANT TITLE MATCH
   * -----------------------------------------------------------
   *
   * Only use fuzzy matching for reasonably-sized strings.
   * This prevents expensive/noisy comparisons against huge text.
   */

  if (
    query.length >= 4 &&
    query.length <= 80 &&
    title.length <= 120 &&
    !title.includes(query)
  ) {
    const similarity =
      fuzzySimilarity(
        title,
        query
      );

    if (similarity >= 0.88) {
      score += 220;
      addMatch(
        matches,
        "fuzzy_title"
      );
    } else if (
      similarity >= 0.78
    ) {
      score += 100;
      addMatch(
        matches,
        "fuzzy_title"
      );
    }
  }

  /*
   * Word-level typo matching.
   *
   * Example:
   *
   * "mystreis"
   *
   * can still match:
   *
   * "mysteries"
   */
  if (
    queryTokens.length > 0
  ) {
    const titleTokens =
      tokenize(title);

    let fuzzyWordMatches = 0;

    for (const queryToken of queryTokens) {
      if (queryToken.length < 4) {
        continue;
      }

      const matched =
        titleTokens.some(
          (titleToken) => {
            if (
              titleToken.length < 4
            ) {
              return false;
            }

            return (
              fuzzySimilarity(
                titleToken,
                queryToken
              ) >= 0.78
            );
          }
        );

      if (matched) {
        fuzzyWordMatches += 1;
      }
    }

    if (fuzzyWordMatches > 0) {
      score +=
        fuzzyWordMatches * 45;

      addMatch(
        matches,
        "fuzzy_title"
      );
    }
  }

  /*
   * -----------------------------------------------------------
   * AUTHOR
   * -----------------------------------------------------------
   */

  if (author) {
    if (author === query) {
      score += 300;
      addMatch(
        matches,
        "author"
      );
    } else if (
      author.includes(query)
    ) {
      score += 180;
      addMatch(
        matches,
        "author"
      );
    } else if (
      queryTokens.length > 0 &&
      allTokensMatch(
        author,
        queryTokens
      )
    ) {
      score += 120;
      addMatch(
        matches,
        "author"
      );
    }
  }

  /*
   * -----------------------------------------------------------
   * PRIMARY GENRE
   * -----------------------------------------------------------
   */

  if (genre) {
    if (genre === query) {
      score += 150;
      addMatch(
        matches,
        "genre"
      );
    } else if (
      genre.includes(query)
    ) {
      score += 90;
      addMatch(
        matches,
        "genre"
      );
    }
  }

  /*
   * -----------------------------------------------------------
   * TAGS
   * -----------------------------------------------------------
   */

  if (tags.length > 0) {
    let tagScore = 0;

    for (const tag of tags) {
      if (tag === query) {
        tagScore += 120;
        continue;
      }

      if (
        tag.includes(query)
      ) {
        tagScore += 60;
        continue;
      }

      if (
        queryTokens.length > 0 &&
        queryTokens.some(
          (token) =>
            tag.includes(token)
        )
      ) {
        tagScore += 25;
      }
    }

    /*
     * Prevent novels with enormous tag lists from dominating
     * results simply because they matched many generic tags.
     */
    tagScore = Math.min(
      tagScore,
      240
    );

    if (tagScore > 0) {
      score += tagScore;
      addMatch(
        matches,
        "tag"
      );
    }
  }

  /*
   * -----------------------------------------------------------
   * SYNOPSIS
   * -----------------------------------------------------------
   *
   * Synopsis is deliberately weak. A title match should almost
   * always outrank a novel that merely mentions the query in its
   * description.
   */

  if (synopsis) {
    if (
      synopsis.includes(query)
    ) {
      score += 40;
      addMatch(
        matches,
        "synopsis"
      );
    } else if (
      queryTokens.length > 0
    ) {
      const matchedTokens =
        queryTokens.filter(
          (token) =>
            synopsis.includes(
              token
            )
        ).length;

      if (matchedTokens > 0) {
        score += Math.min(
          matchedTokens * 10,
          30
        );

        addMatch(
          matches,
          "synopsis"
        );
      }
    }
  }

  if (score <= 0) {
    return null;
  }

  return {
    novel,
    score,
    matched_on:
      Array.from(matches),
  };
}

export function searchNovels<
  T extends SearchableNovel
>(
  novels: T[],
  query: string,
  options: SearchNovelsOptions = {}
): NovelSearchResult<T>[] {
  const normalizedQuery =
    normalizeText(query);

  /*
   * Empty search:
   *
   * Return the input order unchanged. This allows Library's
   * existing sorting system to remain responsible for browse
   * mode.
   */
  if (!normalizedQuery) {
    return novels
      .slice(
        0,
        options.limit ??
          DEFAULT_LIMIT
      )
      .map((novel) => ({
        novel,
        score: 0,
        matched_on: [],
      }));
  }

  const minimumScore =
    options.minimumScore ??
    DEFAULT_MINIMUM_SCORE;

  const limit =
    options.limit ??
    DEFAULT_LIMIT;

  return novels
    .map((novel) =>
      scoreNovel(
        novel,
        normalizedQuery
      )
    )
    .filter(
      (
        result
      ): result is NovelSearchResult<T> =>
        result !== null &&
        result.score >=
          minimumScore
    )
    .sort((a, b) => {
      /*
       * Search relevance first.
       */
      if (
        b.score !== a.score
      ) {
        return (
          b.score - a.score
        );
      }

      /*
       * Stable-ish deterministic fallback.
       */
      return a.novel.title.localeCompare(
        b.novel.title
      );
    })
    .slice(0, limit);
}