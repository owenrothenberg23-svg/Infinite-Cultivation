// app/api/admin/normalize-genres/route.ts

import { NextResponse } from "next/server";

import {
  normalizeNovelGenre,
  type CanonicalGenre,
} from "@/lib/novelGenres/normalizeGenre";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 10_000;
const PAGE_SIZE = 1000;
const SAMPLE_LIMIT = 40;

type NovelRow = {
  id: string;
  title: string;
  primary_genre: string | null;
  tags: string[] | null;
};

type PlannedUpdate = {
  id: string;
  primary_genre: CanonicalGenre;
};

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && admins.includes(email.toLowerCase()));
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

async function loadNovels(limit: number): Promise<NovelRow[]> {
  const admin = supabaseAdmin();
  const rows: NovelRow[] = [];

  let from = 0;

  while (rows.length < limit) {
    const remaining = limit - rows.length;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    const to = from + pageSize - 1;

    const { data, error } = await admin
      .from("novels")
      .select("id,title,primary_genre,tags")
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(
        `Failed to load novels: ${error.message}`
      );
    }

    const page = (data as NovelRow[] | null) ?? [];

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += page.length;
  }

  return rows.slice(0, limit);
}

export async function POST(request: Request) {
  try {
    const ssr = await supabaseServerClient();

    const {
      data: userData,
      error: userError,
    } = await ssr.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { error: `Authentication failed: ${userError.message}` },
        { status: 401 }
      );
    }

    const user = userData?.user;

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      apply?: boolean;
      limit?: number;
    };

    const apply = body.apply === true;

    const requestedLimit = Number(body.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), MAX_LIMIT))
      : DEFAULT_LIMIT;

    const novels = await loadNovels(limit);

    const beforeCounts: Record<string, number> = {};
    const afterCounts: Record<string, number> = {};
    const transitionCounts: Record<string, number> = {};
    const updates: PlannedUpdate[] = [];

    const samples: Array<{
      id: string;
      title: string;
      from: string | null;
      to: CanonicalGenre;
      reasons: string[];
    }> = [];

    let changed = 0;
    let unchanged = 0;

    for (const novel of novels) {
      const before = novel.primary_genre?.trim() || "(null)";
      increment(beforeCounts, before);

      const normalized = normalizeNovelGenre({
        primaryGenre: novel.primary_genre,
        tags: novel.tags,
      });

      increment(afterCounts, normalized.primaryGenre);

      if (!normalized.changed) {
        unchanged += 1;
        continue;
      }

      changed += 1;

      increment(
        transitionCounts,
        `${before} -> ${normalized.primaryGenre}`
      );

      updates.push({
        id: novel.id,
        primary_genre: normalized.primaryGenre,
      });

      if (samples.length < SAMPLE_LIMIT) {
        samples.push({
          id: novel.id,
          title: novel.title,
          from: novel.primary_genre,
          to: normalized.primaryGenre,
          reasons: normalized.reasons,
        });
      }
    }

    if (apply && updates.length > 0) {
      const admin = supabaseAdmin();

      for (const update of updates) {
        const { error: updateError } = await admin
          .from("novels")
          .update({
            primary_genre: update.primary_genre,
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.id);

        if (updateError) {
          return NextResponse.json(
            {
              error:
                `Genre normalization stopped during update: ${updateError.message}`,
              mode: "apply",
              scanned: novels.length,
              planned_changes: changed,
            },
            { status: 500 }
          );
        }
      }
    }

    const transitions = Object.entries(transitionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([transition, count]) => ({
        transition,
        count,
      }));

    return NextResponse.json({
      success: true,
      mode: apply ? "apply" : "preview",
      scanned: novels.length,
      changed,
      unchanged,
      applied: apply ? changed : 0,
      before_counts: beforeCounts,
      after_counts: afterCounts,
      transitions,
      samples,
      note: apply
        ? "Canonical primary genres were written to novels."
        : "Preview only. No database rows were changed.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown genre normalization error.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}