import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

function isAdmin(email: string | undefined | null) {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return !!email && admins.includes(email.toLowerCase());
}

export async function POST(req: Request) {
  try {
    const ssr = await supabaseServerClient();
    const { data: userData } = await ssr.auth.getUser();

    if (!isAdmin(userData?.user?.email)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const fd = await req.formData();

    const novelId = String(fd.get("novel_id") || "").trim();
    const relatedNovelId = String(fd.get("related_novel_id") || "").trim();
    const score = Number(fd.get("score") || 1);
    const bidirectional = fd.get("bidirectional") === "on";

    if (!novelId || !relatedNovelId) {
      return NextResponse.json(
        { error: "Missing novel_id or related_novel_id" },
        { status: 400 }
      );
    }

    if (novelId === relatedNovelId) {
      return NextResponse.json(
        { error: "A novel cannot be related to itself" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const rows = [
      {
        novel_id: novelId,
        related_novel_id: relatedNovelId,
        score: Number.isFinite(score) ? score : 1,
      },
    ];

    if (bidirectional) {
      rows.push({
        novel_id: relatedNovelId,
        related_novel_id: novelId,
        score: Number.isFinite(score) ? score : 1,
      });
    }

    const { error } = await admin
      .from("novel_relationships")
      .upsert(rows, {
        onConflict: "novel_id,related_novel_id",
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL("/admin/relationships", req.url), {
      status: 303,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}