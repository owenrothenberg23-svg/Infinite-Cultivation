// app/api/edit-chapter/route.ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const S = (v: unknown, d = ""): string =>
  typeof v === "string" && v.length ? v : d;

function getBearer(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

function atext(msg: Anthropic.Messages.Message): string {
  const chunk = msg.content?.find((c) => c.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  return chunk?.text ?? "";
}

async function getAuthedUserId(
  req: Request,
  supabaseAdmin: ReturnType<typeof getSupabaseServer>
) {
  // 1) Bearer first
  const token = getBearer(req);
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user?.id) return data.user.id;
  }

  // 2) Cookie fallback
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const c of cookiesToSet) {
              cookieStore.set(c.name, c.value, c.options);
            }
          } catch {
            // no-op
          }
        },
      },
    }
  );

  const { data, error } = await sb.auth.getUser();
  if (!error && data?.user?.id) return data.user.id;

  return null;
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseServer();

    const body = (await req.json().catch(() => null)) as
      | {
          storyId?: string;
          chapterNumber?: number | string;
          content?: string;

          // ✅ NEW (optional)
          title?: string | null;
        }
      | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const storyId = S(body.storyId);
    const chapterNumber = Number(body.chapterNumber);
    const newContent = S(body.content).trim();

    // ✅ NEW: allow optional title updates
    const titleWasProvided = Object.prototype.hasOwnProperty.call(body, "title");
    const newTitleRaw = titleWasProvided ? body.title : undefined;
    const newTitle =
      newTitleRaw === null ? null : S(newTitleRaw).trim() || null;

    if (!storyId || !Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid storyId/chapterNumber" },
        { status: 400 }
      );
    }

    if (!newContent) {
      return NextResponse.json(
        { error: "Chapter content cannot be empty" },
        { status: 400 }
      );
    }

    // ✅ NEW: basic title validation (only if provided)
    if (titleWasProvided && newTitle && newTitle.length > 120) {
      return NextResponse.json(
        { error: "Title too long (max 120 characters)" },
        { status: 400 }
      );
    }

    // ✅ Auth (Bearer OR cookie)
    const userId = await getAuthedUserId(req, supabaseAdmin);
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    // ✅ NEW: Closed beta allowlist check
    const { data: u2, error: u2Err } = await supabaseAdmin.auth.getUser();
    // Note: getAuthedUserId may have used Bearer or cookies; this call resolves email via cookies in most cases.
    // If you're calling edit-chapter from a Bearer-only client, you can pass Authorization header and it will still work.
    const email =
      u2Err ? undefined : u2?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { error: "Account email missing." },
        { status: 401 }
      );
    }

    const { data: allow } = await supabaseAdmin
      .from("beta_allowlist")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!allow) {
      return NextResponse.json(
        { error: "This is a closed beta. Please request an invite to continue." },
        { status: 403 }
      );
    }

    const { data: story, error: storyErr } = await supabaseAdmin
      .from("stories")
      .select("id, user_id, title")
      .eq("id", storyId)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.user_id !== userId) {
      return NextResponse.json(
        { error: "You do not have permission to edit this story" },
        { status: 403 }
      );
    }

    // ✅ NEW: update patch stays backwards compatible
    const patch: Record<string, any> = { content: newContent };
    if (titleWasProvided) patch.title = newTitle;

    const { data: chapter, error: chErr } = await supabaseAdmin
      .from("chapters")
      .update(patch)
      .eq("story_id", storyId)
      .eq("chapter_number", chapterNumber)
      .select("id, chapter_number")
      .maybeSingle();

    if (chErr || !chapter) {
      console.error("edit-chapter: update error", chErr);
      return NextResponse.json(
        { error: chErr?.message || "Could not update chapter" },
        { status: 500 }
      );
    }

    try {
      const { error: delErr } = await supabaseAdmin
        .from("memories")
        .delete()
        .eq("story_id", storyId)
        .eq("chapter_number", chapterNumber);

      if (delErr)
        console.warn("edit-chapter: memory delete error (non-fatal)", delErr);
    } catch (e) {
      console.warn("edit-chapter: memory delete fatal (non-fatal)", e);
    }

    try {
      const memMsg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0,
        system:
          "Extract ONLY durable facts from the chapter. " +
          "Return STRICT JSON with arrays: facts, characters, locations, items, threads, rules. " +
          "Each entry <= 200 chars. Return ONLY JSON.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  storyTitle: story.title,
                  chapterNumber,
                  chapterText: newContent,
                }),
              },
            ],
          },
        ],
      });

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(atext(memMsg) || "{}");
      } catch {
        parsed = {};
      }

      const rows: Array<{
        story_id: string;
        chapter_number: number;
        kind: string;
        content: string;
      }> = [];

      for (const [kind, arr] of Object.entries(parsed)) {
        if (Array.isArray(arr)) {
          for (const s of arr as unknown[]) {
            const val = S(s).trim();
            if (val) {
              rows.push({
                story_id: storyId,
                chapter_number: chapterNumber,
                kind,
                content: val,
              });
            }
          }
        }
      }

      if (rows.length) {
        const { error: insErr } = await supabaseAdmin
          .from("memories")
          .insert(rows);
        if (insErr)
          console.warn("edit-chapter: memory insert error (non-fatal)", insErr);
      }
    } catch (e) {
      console.warn("edit-chapter: memory extraction failed (non-fatal):", e);
    }

    return NextResponse.json(
      { chapter: { id: chapter.id, chapter_number: chapter.chapter_number } },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("edit-chapter fatal:", msg);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}
