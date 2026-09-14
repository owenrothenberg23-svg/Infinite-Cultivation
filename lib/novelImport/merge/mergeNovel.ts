// lib/novelImport/merge/mergeNovel.ts

import { supabaseAdmin } from "@/lib/supabase";

import {
  chooseMaxNumber,
  chooseStatus,
  chooseString,
  mergeTags,
} from "./chooseCanonical";

type MergeNovelInput = {
  novelId: number;

  title?: string | null;
  authorName?: string | null;
  coverImageUrl?: string | null;
  synopsis?: string | null;
  primaryGenre?: string | null;
  tags?: string[];
  status?: string | null;
  chaptersTotal?: number | null;
  country?: string | null;
};

type ExistingNovel = {
  id: number;
  title: string;
  author_name: string | null;
  cover_image_url: string | null;
  synopsis: string | null;
  primary_genre: string | null;
  tags: string[] | null;
  status: string | null;
  chapters_total: number | null;
  country: string | null;
};

export async function mergeCanonicalNovel(
  input: MergeNovelInput
) {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("novels")
    .select(
      `
        id,
        title,
        author_name,
        cover_image_url,
        synopsis,
        primary_genre,
        tags,
        status,
        chapters_total,
        country
      `
    )
    .eq("id", input.novelId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      `Canonical novel ${input.novelId} was not found.`
    );
  }

  const existing = data as ExistingNovel;

  const merged = {
    title:
      chooseString(existing.title, input.title) ||
      existing.title,

    author_name: chooseString(
      existing.author_name,
      input.authorName
    ),

    cover_image_url: chooseString(
      existing.cover_image_url,
      input.coverImageUrl
    ),

    synopsis: chooseString(
      existing.synopsis,
      input.synopsis
    ),

    primary_genre: chooseString(
      existing.primary_genre,
      input.primaryGenre
    ),

    tags: mergeTags(
      existing.tags,
      input.tags
    ),

    status: chooseStatus(
      existing.status,
      input.status
    ),

    chapters_total: chooseMaxNumber(
      existing.chapters_total,
      input.chaptersTotal
    ),

    country: chooseString(
      existing.country,
      input.country
    ),

    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } =
    await admin
      .from("novels")
      .update(merged)
      .eq("id", input.novelId)
      .select(
        `
          id,
          title,
          author_name,
          cover_image_url,
          synopsis,
          primary_genre,
          tags,
          status,
          chapters_total,
          country
        `
      )
      .single();

  if (updateError) {
    throw updateError;
  }

  return updated;
}