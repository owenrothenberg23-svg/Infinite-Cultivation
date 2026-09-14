// lib/novelImport/registry/index.ts

import type { NovelSourceAdapter } from "./types";

import { royalRoadAdapter } from "../adapters/royalRoad";
import { mtlNovelAdapter } from "../adapters/mtlNovel";
import { novelCoolAdapter } from "../adapters/novelCool";
import { novelBuddyAdapter } from "../adapters/novelBuddy";

export const novelSourceAdapters: NovelSourceAdapter[] = [
  royalRoadAdapter,
  mtlNovelAdapter,
  novelCoolAdapter,
  novelBuddyAdapter,
];

export function findNovelSourceAdapter(
  url: URL
): NovelSourceAdapter | null {
  return (
    novelSourceAdapters.find((adapter) =>
      adapter.supports(url)
    ) ?? null
  );
}