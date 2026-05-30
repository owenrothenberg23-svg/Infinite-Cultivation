// app/api/import-novel/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export const runtime = "nodejs";

function sourceSiteFromUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function cleanTags(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean)
    .slice(0, 20);
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServerClient();

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const fd = await req.formData();

    const source_url = String(fd.get("source_url") || "").trim();
    const raw_title = String(fd.get("raw_title") || "").trim();
    const raw_payload = String(fd.get("raw_payload") || "").trim();

    if (!source_url && !raw_title && !raw_payload) {
      return NextResponse.json(
        { error: "Add a URL, title, or pasted metadata." },
        { status: 400 }
      );
    }

    const suggested_source_site = source_url ? sourceSiteFromUrl(source_url) : null;

    // MVP extraction: conservative guesses only.
    const suggested_title = raw_title || null;

    const authorMatch = raw_payload.match(/author\s*[:\-]\s*(.+)/i);
    const genreMatch = raw_payload.match(/genre\s*[:\-]\s*(.+)/i);
    const tagsMatch = raw_payload.match(/tags?\s*[:\-]\s*(.+)/i);

    const suggested_author = authorMatch?.[1]?.split("\n")[0]?.trim() || null;
    const suggested_primary_genre =
      genreMatch?.[1]?.split(/[,\n]/)[0]?.trim().toLowerCase().replace(/\s+/g, "_") ||
      null;
    const suggested_tags = tagsMatch?.[1] ? cleanTags(tagsMatch[1]) : null;

    const { data, error } = await sb
      .from("novel_import_queue")
      .insert({
        source_url: source_url || null,
        raw_title: raw_title || null,
        raw_payload: raw_payload || null,
        suggested_title,
        suggested_author,
        suggested_source_site,
        suggested_primary_genre,
        suggested_tags,
        created_by: userData.user.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json(
        { error: error?.message || "Failed to submit import" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL(`/import?submitted=${data.id}`, req.url), {
      status: 303,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}