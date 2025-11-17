// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
    } else {
      setMessage("Signed in, but no session returned. Check your auth settings.");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (!username.trim()) {
      setError("Please choose a username.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Depending on your Supabase email confirmation setting, you may
    // or may not get a session immediately.
    if (data.session) {
      router.replace("/dashboard");
    } else {
      setMessage("Account created. Please check your email to confirm your address.");
    }
  }

  const isSignin = mode === "signin";

  return (
    <main className="max-w-md mx-auto p-8 text-gray-200">
      <h1 className="text-2xl font-bold mb-4">Infinite Cultivation</h1>

      {/* Tabs */}
      <div className="flex mb-6 border-b border-gray-700">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
            setMessage(null);
          }}
          className={`flex-1 py-2 text-sm font-medium ${
            isSignin
              ? "border-b-2 border-indigo-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setMessage(null);
          }}
          className={`flex-1 py-2 text-sm font-medium ${
            !isSignin
              ? "border-b-2 border-indigo-500 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Create account
        </button>
      </div>

      <form
        onSubmit={isSignin ? handleSignIn : handleSignUp}
        className="space-y-4 bg-white/5 p-6 rounded-lg border border-white/10"
      >
        {!isSignin && (
          <label className="block text-sm">
            <span className="block mb-1 text-gray-300">Username</span>
            <input
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-100"
              placeholder="HeavenlySword"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="block mb-1 text-gray-300">Email</span>
          <input
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-100"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="block mb-1 text-gray-300">Password</span>
          <input
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-100"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading
            ? isSignin
              ? "Signing in…"
              : "Creating account…"
            : isSignin
            ? "Sign in"
            : "Create account"}
        </button>
      </form>
    </main>
  );
}
