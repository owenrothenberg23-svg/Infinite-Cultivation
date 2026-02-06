// app/api/publish-story/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

function getBearer(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const storyId = body.storyId as string | undefined;
    const summary = (body.summary as string | undefined) ?? null;

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const sb = getSupabaseServer();

    // ✅ Auth required (Bearer)
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }

    // ✅ NEW: Closed beta allowlist check
    const email = userData.user.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json(
        { error: "Account email missing." },
        { status: 401 }
      );
    }

    const { data: allow } = await sb
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

    const userId = userData.user.id;

    // Load story + ownership + current publish state
    const { data: story, error: storyErr } = await sb
      .from("stories")
      .select("id, user_id, is_public")
      .eq("id", storyId)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.user_id !== userId) {
      return NextResponse.json(
        { error: "You do not have permission to publish this story" },
        { status: 403 }
      );
    }

    if (story.is_public) {
      return NextResponse.json(
        { error: "Story is already published" },
        { status: 409 }
      );
    }

    const { error: updateErr } = await sb
      .from("stories")
      .update({
        is_public: true,
        public_summary: summary,
      })
      .eq("id", storyId);

    if (updateErr) {
      console.error("publish-story update error:", updateErr);
      return NextResponse.json(
        { error: updateErr.message ?? "Failed to publish story" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("publish-story fatal:", e);
    return NextResponse.json(
      { error: e?.message || "Unexpected error while publishing story" },
      { status: 500 }
    );
  }
}
