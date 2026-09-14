// lib/novelImport/registry/types.ts

import type { ImportedNovelMetadata } from "../types";

export type NovelParserContext = {
  auxiliary?: Record<string, string>;
};

export type NovelSourceAdapter = {
  id: string;

  hostnames: string[];

  supports: (url: URL) => boolean;

  parse: (
    html: string,
    url: string,
    context?: NovelParserContext
  ) => ImportedNovelMetadata;
};