import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const ENABLED = process.env.BETA_GRANT_ENABLED === "true";
const OWNER_EMAIL = (process.env.BETA_OWNER_EMAIL || "")
  .trim()
  .toLowerCase();

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number
) {
  const parsed = Number(value ?? String(fallback));

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

type ClaimResult = {
  ok?: boolean;
  status?: string;
  granted?: number;
  newBalance?: number | null;
  grantedCount?: number;
};

export async function POST() {
  try {
    if (!ENABLED) {
      return NextResponse.json(
        { ok: true, skipped: "disabled" },
        { status: 200 }
      );
    }

    const maxUsers = readPositiveInteger(
      process.env.BETA_MAX_USERS,
      50,
      10_000
    );

    const grant = readPositiveInteger(
      process.env.BETA_GRANT_STONES,
      20,
      1_000
    );

    if (maxUsers === null || grant === null) {
      console.error("beta grant: invalid environment configuration");

      return NextResponse.json(
        { error: "Beta grant is unavailable" },
        { status: 503 }
      );
    }

    // Resolve and verify the current user server-side.
    const sb = getSupabaseServer();
    const { data: userData, error: userError } =
      await sb.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: "Not logged in" },
        { status: 401 }
      );
    }

    const user = userData.user;
    const email = (user.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Account email is unavailable" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Enforce beta access inside the route instead of relying only on proxy.ts.
    const isOwner = Boolean(OWNER_EMAIL && email === OWNER_EMAIL);

    if (!isOwner) {
      const { data: allowlistRow, error: allowlistError } =
        await admin
          .from("beta_allowlist")
          .select("email")
          .eq("email", email)
          .maybeSingle();

      if (allowlistError) {
        console.error(
          "beta grant: allowlist lookup failed",
          allowlistError
        );

        return NextResponse.json(
          { error: "Could not verify beta access" },
          { status: 503 }
        );
      }

      if (!allowlistRow?.email) {
        return NextResponse.json(
          { error: "Beta access required" },
          { status: 403 }
        );
      }
    }

    // The database function performs the cap check, idempotency check,
    // balance increment, and grant marker update in one transaction.
    const { data, error: claimError } = await admin.rpc(
      "claim_beta_grant",
      {
        p_user_id: user.id,
        p_amount: grant,
        p_max_users: maxUsers,
      }
    );

    if (claimError) {
      console.error("beta grant: claim failed", claimError);

      return NextResponse.json(
        { error: "Could not grant stones" },
        { status: 500 }
      );
    }

    const result = data as ClaimResult | null;

    if (!result || result.ok !== true) {
      if (result?.status === "profile_not_found") {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 409 }
        );
      }

      console.error("beta grant: unexpected claim result", result);

      return NextResponse.json(
        { error: "Could not grant stones" },
        { status: 500 }
      );
    }

    if (result.status === "already_granted") {
      return NextResponse.json(
        {
          ok: true,
          already: true,
          newBalance: result.newBalance ?? null,
        },
        { status: 200 }
      );
    }

    if (result.status === "cap_reached") {
      return NextResponse.json(
        {
          ok: true,
          skipped: "cap_reached",
          grantedCount: result.grantedCount ?? maxUsers,
        },
        { status: 200 }
      );
    }

    if (result.status !== "granted") {
      console.error("beta grant: unknown claim status", result.status);

      return NextResponse.json(
        { error: "Could not grant stones" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        granted: result.granted ?? grant,
        newBalance: result.newBalance ?? null,
        grantedCount: result.grantedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("beta grant fatal:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
