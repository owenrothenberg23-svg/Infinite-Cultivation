// lib/novelGenres/normalizeGenre.ts

export type CanonicalGenre =
  | "xianxia"
  | "xuanhuan"
  | "wuxia"
  | "litrpg"
  | "progression_fantasy"
  | "eastern_fantasy"
  | "urban_fantasy"
  | "sci_fantasy"
  | "horror"
  | "mystery"
  | "romance"
  | "historical"
  | "fan_fiction"
  | "fantasy"
  | "action_adventure";

export type NormalizeGenreInput = {
  primaryGenre?: string | null;
  tags?: string[] | null;
};

export type NormalizeGenreResult = {
  primaryGenre: CanonicalGenre;
  changed: boolean;
  previousGenre: string | null;
  reasons: string[];
};

function normalizeToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTags(tags: string[] | null | undefined) {
  return new Set((tags || []).map(normalizeToken).filter(Boolean));
}

function hasAny(tags: Set<string>, values: string[]) {
  return values.some((value) => tags.has(value));
}

function result(
  previousGenre: string | null,
  primaryGenre: CanonicalGenre,
  reasons: string[]
): NormalizeGenreResult {
  return {
    primaryGenre,
    changed: normalizeToken(previousGenre) !== primaryGenre,
    previousGenre,
    reasons,
  };
}

const BROAD_PRIMARY_GENRES = new Set([
  "",
  "fantasy",
  "action",
  "adventure",
  "action_adventure",
  "eastern",
  "eastern_fantasy",
  "game",
]);

const PROTECTED_PRIMARY_GENRES = new Set([
  "xianxia",
  "xuanhuan",
  "wuxia",
  "progression_fantasy",
  "sci_fantasy",
  "romance",
  "horror",
  "historical",
  "mystery",
  "urban",
  "urban_life",
  "urban_fantasy",
  "fan_fiction",
  "fanfiction",
]);

export function normalizeNovelGenre(
  input: NormalizeGenreInput
): NormalizeGenreResult {
  const previousGenre = input.primaryGenre?.trim() || null;
  const primary = normalizeToken(input.primaryGenre);
  const tags = normalizeTags(input.tags);

  if (primary) {
    tags.add(primary);
  }

  /*
   * 1. Preserve explicit, specific primary genres first.
   * These should not be casually overridden by secondary tags.
   */
  if (primary === "xianxia") {
    return result(previousGenre, "xianxia", ["preserve_primary_xianxia"]);
  }

  if (primary === "xuanhuan") {
    return result(previousGenre, "xuanhuan", ["preserve_primary_xuanhuan"]);
  }

  if (primary === "wuxia") {
    return result(previousGenre, "wuxia", ["preserve_primary_wuxia"]);
  }

  if (primary === "progression_fantasy") {
    return result(previousGenre, "progression_fantasy", [
      "preserve_primary_progression_fantasy",
    ]);
  }

  if (primary === "sci_fantasy") {
    return result(previousGenre, "sci_fantasy", [
      "preserve_primary_sci_fantasy",
    ]);
  }

  if (primary === "romance") {
    return result(previousGenre, "romance", ["preserve_primary_romance"]);
  }

  if (primary === "horror") {
    return result(previousGenre, "horror", ["preserve_primary_horror"]);
  }

  if (primary === "historical") {
    return result(previousGenre, "historical", [
      "preserve_primary_historical",
    ]);
  }

  if (primary === "mystery") {
    return result(previousGenre, "mystery", ["preserve_primary_mystery"]);
  }

  if (
    primary === "urban" ||
    primary === "urban_life" ||
    primary === "urban_fantasy"
  ) {
    return result(previousGenre, "urban_fantasy", ["normalize_primary_urban"]);
  }

  if (primary === "fan_fiction" || primary === "fanfiction") {
    return result(previousGenre, "fan_fiction", [
      "normalize_primary_fan_fiction",
    ]);
  }

  /*
   * 2. Strong explicit tags can refine broad primary genres.
   * This only runs when the current primary is broad or missing.
   */
  const canRefineBroadPrimary =
    BROAD_PRIMARY_GENRES.has(primary) ||
    !primary ||
    !PROTECTED_PRIMARY_GENRES.has(primary);

  if (canRefineBroadPrimary) {
    if (tags.has("xianxia")) {
      return result(previousGenre, "xianxia", ["explicit_tag_xianxia"]);
    }

    if (tags.has("xuanhuan")) {
      return result(previousGenre, "xuanhuan", ["explicit_tag_xuanhuan"]);
    }

    if (tags.has("wuxia")) {
      return result(previousGenre, "wuxia", ["explicit_tag_wuxia"]);
    }
  }

  /*
   * 3. LitRPG requires strong game-system evidence.
   * We do NOT demote a protected primary like sci_fantasy
   * or progression_fantasy merely because a game tag exists.
   */
  const litrpgSignals = [
    "litrpg",
    "game_elements",
    "level_system",
    "leveling_system",
    "game_system",
    "virtual_reality",
    "mmorpg",
    "rpg",
  ];

  const hasStrongLitrpgSignal =
    hasAny(tags, litrpgSignals) ||
    (tags.has("system") &&
      (tags.has("game") ||
        tags.has("leveling") ||
        tags.has("game_elements")));

  if (
    (primary === "game" || primary === "litrpg") &&
    hasStrongLitrpgSignal
  ) {
    return result(previousGenre, "litrpg", [
      "primary_game_with_litrpg_signals",
    ]);
  }

  if (
    canRefineBroadPrimary &&
    hasStrongLitrpgSignal
  ) {
    return result(previousGenre, "litrpg", ["litrpg_signals"]);
  }

  /*
   * 4. Progression Fantasy can refine broad fantasy/action only
   * when explicitly tagged.
   */
  if (
    canRefineBroadPrimary &&
    tags.has("progression_fantasy")
  ) {
    return result(previousGenre, "progression_fantasy", [
      "explicit_tag_progression_fantasy",
    ]);
  }

  /*
   * 5. Eastern cultivation inference.
   * Use strong evidence only.
   */
  if (
    canRefineBroadPrimary &&
    tags.has("cultivation") &&
    tags.has("martial_arts")
  ) {
    return result(previousGenre, "xianxia", [
      "cultivation_and_martial_arts",
    ]);
  }

  if (
    primary === "eastern" ||
    primary === "eastern_fantasy"
  ) {
    return result(previousGenre, "eastern_fantasy", [
      "normalize_primary_eastern",
    ]);
  }

  if (
    canRefineBroadPrimary &&
    tags.has("eastern")
  ) {
    return result(previousGenre, "eastern_fantasy", [
      "eastern_tag_on_broad_primary",
    ]);
  }

  /*
   * 6. Sci-fi may refine broad primary genres,
   * but never override a protected genre.
   */
  if (
    canRefineBroadPrimary &&
    (tags.has("sci_fi") ||
      tags.has("science_fiction") ||
      tags.has("sci_fantasy"))
  ) {
    return result(previousGenre, "sci_fantasy", [
      "science_fiction_signal",
    ]);
  }

  /*
   * 7. Secondary-theme tags such as mystery and historical
   * should only become primary when the current genre is broad.
   */
  if (
    canRefineBroadPrimary &&
    tags.has("horror")
  ) {
    return result(previousGenre, "horror", ["horror_signal"]);
  }

  if (
    canRefineBroadPrimary &&
    tags.has("mystery")
  ) {
    return result(previousGenre, "mystery", ["mystery_signal"]);
  }

  if (
    canRefineBroadPrimary &&
    tags.has("historical")
  ) {
    return result(previousGenre, "historical", ["historical_signal"]);
  }

  if (
    canRefineBroadPrimary &&
    (tags.has("fan_fiction") || tags.has("fanfiction"))
  ) {
    return result(previousGenre, "fan_fiction", [
      "fan_fiction_signal",
    ]);
  }

  /*
   * 8. Romance tag does not override broad fantasy/action by default.
   * Only an explicit primary romance remains Romance.
   */

  /*
   * 9. Broad fallbacks.
   */
  if (primary === "fantasy" || tags.has("fantasy")) {
    return result(previousGenre, "fantasy", ["fantasy_fallback"]);
  }

  if (
    primary === "action" ||
    primary === "adventure" ||
    primary === "action_adventure" ||
    tags.has("action") ||
    tags.has("adventure")
  ) {
    return result(previousGenre, "action_adventure", [
      "action_adventure_fallback",
    ]);
  }

  /*
   * 10. Rare unsupported primaries stay in a broad canonical bucket
   * instead of creating one-off top-level categories.
   */
  return result(previousGenre, "fantasy", [
    primary ? `unsupported_primary:${primary}` : "missing_primary_genre",
  ]);
}