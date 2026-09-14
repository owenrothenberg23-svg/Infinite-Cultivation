// lib/novelImport/merge/chooseCanonical.ts

export function chooseString(
  current: string | null | undefined,
  incoming: string | null | undefined
) {
  const currentValue = current?.trim() || null;
  const incomingValue = incoming?.trim() || null;

  return currentValue || incomingValue;
}

export function chooseMaxNumber(
  current: number | null | undefined,
  incoming: number | null | undefined
) {
  const currentValue =
    typeof current === "number" && Number.isFinite(current)
      ? current
      : null;

  const incomingValue =
    typeof incoming === "number" && Number.isFinite(incoming)
      ? incoming
      : null;

  if (currentValue === null) return incomingValue;
  if (incomingValue === null) return currentValue;

  return Math.max(currentValue, incomingValue);
}

export function chooseStatus(
  current: string | null | undefined,
  incoming: string | null | undefined
) {
  const normalize = (value: string | null | undefined) =>
    (value || "unknown").trim().toLowerCase();

  const currentValue = normalize(current);
  const incomingValue = normalize(incoming);

  const rank: Record<string, number> = {
    unknown: 0,
    hiatus: 1,
    dropped: 1,
    ongoing: 2,
    completed: 3,
  };

  const currentRank = rank[currentValue] ?? 0;
  const incomingRank = rank[incomingValue] ?? 0;

  return incomingRank > currentRank
    ? incomingValue
    : currentValue;
}

export function mergeTags(
  current: string[] | null | undefined,
  incoming: string[] | null | undefined
) {
  return Array.from(
    new Set([
      ...(current || []),
      ...(incoming || []),
    ].filter(Boolean))
  ).slice(0, 50);
}