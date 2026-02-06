// components/animations/animationRegistry.ts

export type AnimationKey =
  | "title-awakened"
  | "title-storyteller"
  | "title-wealth"
  | "title-primeval"
  | "spirit-pile"
  | "spirit-bag"
  | "spirit-ring";

// These paths are relative to the public/ folder.
export const animationFiles: Record<AnimationKey, string> = {
  "title-awakened": "/animations/titles/awakened.json",
  "title-storyteller": "/animations/titles/storyteller.json",
  "title-wealth": "/animations/titles/wealth.json",
  "title-primeval": "/animations/titles/primeval.json",

  "spirit-pile": "/animations/spirit/pile.json",
  "spirit-bag": "/animations/spirit/bag.json",
  "spirit-ring": "/animations/spirit/ring.json",
};
