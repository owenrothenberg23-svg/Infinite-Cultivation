// app/api/create-list/route.ts
import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerSSR";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    /*
     * Authenticate using the user's real Supabase session.
     */
    const sb = await supabaseServerClient();

    const { data: userData, error: userError } =
      await sb.auth.getUser();

    const user = userData?.user ?? null;

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    /*
     * Read normal HTML form submission.
     */
    const formData = await req.formData();

    const title = String(
      formData.get("title") ?? ""
    ).trim();

    const description = String(
      formData.get("description") ?? ""
    ).trim();

    const isPublic =
      formData.get("is_public") === "on";

    /*
     * Basic validation.
     */
    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (title.length > 120) {
      return NextResponse.json(
        {
          error:
            "Title must be 120 characters or fewer",
        },
        { status: 400 }
      );
    }

    if (description.length > 2000) {
      return NextResponse.json(
        {
          error:
            "Description must be 2000 characters or fewer",
        },
        { status: 400 }
      );
    }

    /*
     * The user has already been authenticated above.
     *
     * Use the server-side admin client for the database write
     * so list creation does not depend on a separate RLS INSERT
     * policy being configured perfectly.
     *
     * IMPORTANT:
     * user_id is taken ONLY from the authenticated session.
     * It is never accepted from the browser/form.
     */
    const admin = supabaseAdmin();

    const { data: list, error: insertError } =
      await admin
        .from("novel_lists")
        .insert({
          user_id: user.id,
          title,
          description:
            description.length > 0
              ? description
              : null,
          is_public: isPublic,
        })
        .select("id")
        .single();

    if (insertError) {
      console.error(
        "create-list insert failed:",
        insertError
      );

      return NextResponse.json(
        {
          error: "Failed to create list",
        },
        { status: 500 }
      );
    }

    if (!list?.id) {
      return NextResponse.json(
        {
          error: "List was created without an ID",
        },
        { status: 500 }
      );
    }

    /*
     * Normal browser form POST:
     * redirect directly to the newly created list.
     */
    return NextResponse.redirect(
      new URL(`/list/${list.id}`, req.url),
      { status: 303 }
    );
  } catch (error) {
    console.error("create-list fatal:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}