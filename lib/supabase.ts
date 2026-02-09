// lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { headers as nextHeaders } from "next/headers";

function requireEnv(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function getSupabaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}
function getAnonKey() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
function getServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * 1) RLS client for API routes that forward Authorization headers.
 */
export async function supabaseRLSFromAuthHeader() {
  const h = await nextHeaders();
  const auth = h.get("authorization") || "";

  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: { persistSession: false },
    global: auth ? { headers: { Authorization: auth } } : {},
  });
}

/**
 * 2) Admin client (bypasses RLS).
 */
export function supabaseAdmin() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false },
  });
}

/**
 * 3) Back-compat export (but make it lazy).
 */
let _admin: SupabaseClient | null = null;
export function getSupabaseServer() {
  if (!_admin) _admin = supabaseAdmin();
  return _admin;
}

// If you still import supabaseServer in old routes, keep this:
export const supabaseServer = {
  get from() {
    // not used; just prevents accidental usage
    throw new Error("Use getSupabaseServer() instead of supabaseServer directly.");
  },
} as any;
