// lib/novelImport/index.ts

import type { ImportedNovelMetadata } from "./types";
import type { NovelParserContext } from "./registry/types";
import { parseGenericMetadata } from "./generic";
import { findNovelSourceAdapter } from "./registry";

export function parseNovelMetadata(
  html: string,
  url: string,
  context?: NovelParserContext
): ImportedNovelMetadata {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return parseGenericMetadata(html, url);
  }

  const adapter =
    findNovelSourceAdapter(parsedUrl);

  if (!adapter) {
    return parseGenericMetadata(html, url);
  }

  return adapter.parse(
    html,
    url,
    context
  );
}