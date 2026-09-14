// lib/novelImport/types.ts

export type ImportedNovelMetadata = {
  source_url: string;
  source_site: string | null;

  suggested_title: string | null;
  suggested_author: string | null;
  suggested_synopsis: string | null;
  suggested_cover_url: string | null;
  suggested_source_site: string | null;
  suggested_primary_genre: string | null;
  suggested_tags: string[];

  external_title: string | null;
  external_author: string | null;
  external_synopsis: string | null;
  external_cover_url: string | null;
  external_genres: string[];
  external_tags: string[];
  external_rating: number | null;
  external_rating_count: number | null;
  external_review_count: number | null;

  chapters_total: number | null;
  status: string | null;
  extraction_method: string;
};