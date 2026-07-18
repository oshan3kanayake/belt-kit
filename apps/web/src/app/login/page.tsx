"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { auth } from "@/lib/firebase";
import { DEFAULT_ACCOUNTS, DEMO_PASSWORD, ROLE_META } from "@/lib/roles";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1718824331840-399943ff5c1e?fm=jpg&q=75&w=2400&auto=format&fit=crop";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password")
          ? "Email or password is incorrect."
          : code.includes("user-not-found")
          ? "No account found for that email."
          : "Could not sign in. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function quickFill(accEmail: string) {
    setEmail(accEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="relative min-h-screen w-full">
      <img src={BG_IMAGE} alt="" className="fixed inset-0 h-full w-full object-cover" />
      <div className="fixed inset-0 bg-black/45" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white/10 px-8 py-10 backdrop-blur-2xl sm:px-14 sm:py-12">
          <h1 className="text-center font-serif text-4xl font-semibold text-white">Belt-Kit</h1>
          <p className="mt-1 text-center text-sm text-white/70">Sign in to your workshop</p>

          <form onSubmit={handleLogin} className="mt-9 space-y-4">
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-full border border-white/25 bg-white/5 px-5 py-3.5 pr-12 text-sm text-white outline-none transition placeholder:text-white/60 focus:border-white/50 focus:bg-white/10"
              />
              <Mail size={18} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/60" />
            </div>

            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-full border border-white/25 bg-white/5 px-5 py-3.5 pr-12 text-sm text-white outline-none transition placeholder:text-white/60 focus:border-white/50 focus:bg-white/10"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-white/60 transition hover:text-white"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={18} /> : <Lock size={18} />}
              </button>
            </div>

            {error && (
              <p className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-2.5 text-center text-sm text-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3.5 text-sm font-semibold text-burgundy-800 transition hover:bg-white/90 disabled:opacity-70"
            >
              {busy ? (
                <><Loader2 size={18} className="animate-spin" /> Signing in…</>
              ) : (
                "Submit"
              )}
            </button>
          </form>

          <div className="mt-8">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-white/50">
              Demo accounts · tap to fill
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {DEFAULT_ACCOUNTS.filter((acc) =>
                ["owner", "advisor", "technician"].includes(acc.role)
              ).map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => quickFill(acc.email)}
                  className="rounded-full border border-white/25 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 transition hover:bg-white/15 hover:text-white"
                >
                  {ROLE_META[acc.role].label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-white/60">
              Password: <span className="font-semibold text-white/85">{DEMO_PASSWORD}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
