// lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

// --- Env ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Hard fail early if env is misconfigured so you don't get weird runtime bugs.
if (!SUPABASE_URL) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL. Set it in your .env file or project settings."
  );
}

if (!ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Set it in your .env file or project settings."
  );
}

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Set it in your server env (NEVER expose this to the client)."
  );
}

/**
 * Admin client (bypasses RLS). Use ONLY in server code (API routes, server actions).
 */
export function supabaseAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Anonymous server client (respects RLS). Safe for server code without Service Role.
 */
export function supabaseAnon() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * RLS client that forwards Authorization header from the incoming request.
 * Use inside API routes if you want to act as the signed-in user.
 */
export async function supabaseRLSFromAuthHeader() {
  // NOTE: headers() is async in your setup, so we MUST await it.
  const h = await headers();
  const auth = h.get("authorization") ?? undefined;

  return createClient(SUPABASE_URL, ANON_KEY, {
    global: auth ? { headers: { Authorization: auth } } : {},
    auth: { persistSession: false },
  });
}

/** Back-compat exports so existing code can keep working */
export const supabaseServer = supabaseAdmin();
export function getSupabaseServer() {
  return supabaseServer;
}
