import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      novelId,
      title,
      reviewText,
      containsSpoilers,
    } = body;

    if (!novelId || !reviewText?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const sb = await supabaseServerClient();

    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { error } = await sb
      .from("novel_reviews")
      .upsert(
        {
          novel_id: novelId,
          user_id: user.id,
          title: title || null,
          review_text: reviewText,
          contains_spoilers: !!containsSpoilers,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "novel_id,user_id",
        }
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}