"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wallet, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "Account created! Check your email to confirm your account, then log in.",
          );
          setIsSignup(false);
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090f] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13131d] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-xl font-bold">
            RV
          </div>

          <h1 className="text-2xl font-bold">RV SpendWise</h1>
          <p className="mt-2 text-sm text-gray-400">
            {isSignup
              ? "Create your account"
              : "Welcome back! Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Email address
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#09090f] px-4">
              <Mail size={18} className="text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent py-3 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">Password</label>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#09090f] px-4">
              <Lock size={18} className="text-gray-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-transparent py-3 text-white outline-none"
              />
            </div>
          </div>

          {message && (
            <p className="rounded-lg bg-violet-500/10 p-3 text-sm text-violet-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            <Wallet size={18} />
            {loading
              ? "Please wait..."
              : isSignup
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isSignup ? "Already have an account?" : "New to RV SpendWise?"}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage("");
            }}
            className="ml-2 font-semibold text-violet-400 hover:text-violet-300"
          >
            {isSignup ? "Sign In" : "Create Account"}
          </button>
        </p>
      </div>
    </main>
  );
}
