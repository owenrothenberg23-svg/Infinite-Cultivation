// lib/unlockTitle.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Unlock a title for a user, given its slug in the `titles` table.
 *
 * Safe to call multiple times: it will no-op if the user already has it.
 */
export async function unlockTitleForUser(
  sb: SupabaseClient | any,
  userId: string,
  titleSlug: string
) {
  try {
    // 1) Find the title by slug
    const { data: title, error: titleErr } = await sb
      .from("titles")
      .select("id, label")
      .eq("slug", titleSlug)
      .maybeSingle();

    if (titleErr || !title) {
      console.error(
        "[unlockTitleForUser] title not found for slug",
        titleSlug,
        titleErr
      );
      return { ok: false as const, reason: "TITLE_NOT_FOUND" as const };
    }

    const titleId = title.id;

    // 2) Check if user already has this title
    const { data: existing, error: existingErr } = await sb
      .from("user_titles")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("title_id", titleId)
      .maybeSingle();

    // PGRST116 = "Results contain 0 rows"
    if (existingErr && (existingErr as any).code !== "PGRST116") {
      console.error(
        "[unlockTitleForUser] error checking existing user_titles row",
        existingErr
      );
      return { ok: false as const, reason: "EXISTING_CHECK_FAILED" as const };
    }

    if (existing) {
      // Already unlocked
      return {
        ok: true as const,
        alreadyHad: true as const,
        titleId,
        label: title.label as string | null,
      };
    }

    // 3) Insert a new user_titles row (locked/unselected by default)
    const { data: inserted, error: insertErr } = await sb
      .from("user_titles")
      .insert({
        user_id: userId,
        title_id: titleId,
        is_active: false,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(
        "[unlockTitleForUser] error inserting user_titles row",
        insertErr
      );
      return { ok: false as const, reason: "INSERT_FAILED" as const };
    }

    return {
      ok: true as const,
      newlyUnlocked: true as const,
      titleId,
      label: title.label as string | null,
      rowId: inserted.id,
    };
  } catch (err) {
    console.error("[unlockTitleForUser] unexpected error", err);
    return { ok: false as const, reason: "UNKNOWN_ERROR" as const };
  }
}
