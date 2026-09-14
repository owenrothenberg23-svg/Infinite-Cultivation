// lib/novelImport/dedupe/normalize.ts

function stripDiacritics(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTitle(value: string | null | undefined) {
  if (!value) return "";

  return stripDiacritics(value)
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/['"“”‘’`]/g, "")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAuthor(value: string | null | undefined) {
  if (!value) return "";

  return stripDiacritics(value)
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/['"“”‘’`]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSourceUrl(
  value: string | null | undefined
) {
  if (!value) return "";

  try {
    const url = new URL(value);

    url.hash = "";

    if (
      url.pathname.length > 1 &&
      url.pathname.endsWith("/")
    ) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export function tokens(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

export function jaccardSimilarity(
  left: string,
  right: string
) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));

  if (
    leftTokens.size === 0 ||
    rightTokens.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union =
    leftTokens.size +
    rightTokens.size -
    intersection;

  if (union <= 0) {
    return 0;
  }

  return intersection / union;
}

export function levenshteinDistance(
  left: string,
  right: string
) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  );

  for (
    let leftIndex = 1;
    leftIndex <= left.length;
    leftIndex += 1
  ) {
    const current = [
      leftIndex,
    ];

    for (
      let rightIndex = 1;
      rightIndex <= right.length;
      rightIndex += 1
    ) {
      const insertion =
        current[rightIndex - 1] + 1;

      const deletion =
        previous[rightIndex] + 1;

      const substitution =
        previous[rightIndex - 1] +
        (
          left[leftIndex - 1] ===
          right[rightIndex - 1]
            ? 0
            : 1
        );

      current[rightIndex] = Math.min(
        insertion,
        deletion,
        substitution
      );
    }

    for (
      let index = 0;
      index < current.length;
      index += 1
    ) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

export function stringSimilarity(
  left: string,
  right: string
) {
  if (!left || !right) return 0;

  if (left === right) return 1;

  const maxLength = Math.max(
    left.length,
    right.length
  );

  if (maxLength === 0) {
    return 1;
  }

  const distance =
    levenshteinDistance(
      left,
      right
    );

  const levenshteinScore =
    1 - distance / maxLength;

  const tokenScore =
    jaccardSimilarity(
      left,
      right
    );

  return Math.max(
    0,
    Math.min(
      1,
      levenshteinScore * 0.7 +
        tokenScore * 0.3
    )
  );
}