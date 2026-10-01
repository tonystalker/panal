"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { AppMonogram } from "@/components/ui/AppMonogram";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Database, 
  Lock, 
  AlertCircle,
  CheckCircle2,
  Sparkles
} from "lucide-react";

export default function SignupPage() {
  const { signUp } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; type: "info" | "error" | "success" } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !email.includes("@")) {
      setMessage({ text: "Please enter a valid email address.", type: "error" });
      return;
    }
    if (!password || password.length < 6) {
      setMessage({ text: "Password must be at least 6 characters.", type: "error" });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await signUp(email, password);
      setMessage({ 
        text: res.message || "Your interest in encrypted sync has been recorded! You can start tracking your days locally right now.", 
        type: "success" 
      });
    } catch {
      setMessage({ text: "Could not record registration. You can use the app locally without an account.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#080809] text-[#f7f7f8] selection:bg-[#a3ff12]/20 selection:text-[#a3ff12]">
      {/* Left Column: Focused Auth Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-14 max-w-xl mx-auto w-full">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <AppMonogram size="sm" />
            <span className="text-base font-bold tracking-tight text-white group-hover:text-[#a3ff12] transition-colors">
              Panal
            </span>
          </Link>
          <span className="text-[11px] font-mono tracking-widest text-[#a1a1aa] uppercase px-2 py-0.5 rounded border border-white/10 bg-[#121214]">
            v1.0 Local
          </span>
        </div>

        {/* Center Content */}
        <div className="my-auto py-6">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/10 bg-[#121214] text-xs font-mono text-[#a1a1aa] mb-4">
              <span className="size-1.5 rounded-full bg-[#a3ff12]" />
              Optional Account Registration
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2">
              Create your account
            </h1>
            <p className="text-sm text-[#a1a1aa] leading-relaxed">
              Panal works completely offline without an account. Registering is optional for future updates.
            </p>
          </div>

          {/* Primary Quick Bypass: Use Locally Without An Account */}
          <div className="p-4 rounded-xl border border-[#a3ff12]/30 bg-[#a3ff12]/5 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-white">Skip registration entirely</p>
                <p className="text-xs text-[#a1a1aa] mt-0.5">Use 100% locally. Your data stays in your browser.</p>
              </div>
              <Button
                asChild
                className="bg-[#a3ff12] text-[#0a0a0b] hover:bg-[#a3ff12]/90 font-medium text-xs h-9 px-4 shrink-0 shadow-sm"
              >
                <Link href="/today">
                  Use locally
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#080809] px-3 font-mono text-[#71717a] uppercase tracking-wider">
                or register for early access
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
                  message.type === "error"
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : message.type === "success"
                    ? "bg-[#a3ff12]/10 border border-[#a3ff12]/20 text-[#a3ff12]"
                    : "bg-white/5 border border-white/10 text-[#a1a1aa]"
                }`}
                role="alert"
              >
                {message.type === "error" ? (
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[#a3ff12]" />
                )}
                <div className="leading-relaxed">{message.text}</div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="block text-xs font-medium text-[#a1a1aa]">
                Email address
              </label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="bg-[#121214] border-white/10 text-white placeholder:text-[#71717a] focus-visible:ring-[#a3ff12]/20 focus-visible:border-[#a3ff12]/50 h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="block text-xs font-medium text-[#a1a1aa]">
                Password
              </label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="bg-[#121214] border-white/10 text-white placeholder:text-[#71717a] focus-visible:ring-[#a3ff12]/20 focus-visible:border-[#a3ff12]/50 h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-confirm-password" className="block text-xs font-medium text-[#a1a1aa]">
                Confirm password
              </label>
              <Input
                id="signup-confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="bg-[#121214] border-white/10 text-white placeholder:text-[#71717a] focus-visible:ring-[#a3ff12]/20 focus-visible:border-[#a3ff12]/50 h-10"
              />
            </div>

            <div className="text-xs text-[#a1a1aa] leading-relaxed pt-1">
              By registering, you agree to our{" "}
              <Link href="/privacy" className="text-white hover:text-[#a3ff12] underline underline-offset-4">
                privacy promise
              </Link>
              . We will never sell your email or upload your personal tracking logs without explicit permission.
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-[#0a0a0b] hover:bg-white/90 font-medium text-xs h-10 transition-colors"
            >
              {loading ? "Registering..." : "Register account"}
            </Button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center text-xs text-[#a1a1aa]">
            <span>Already have an account? </span>
            <Link href="/login" className="text-white hover:text-[#a3ff12] font-medium transition-colors underline-offset-4 hover:underline">
              Log in
            </Link>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="pt-6 border-t border-white/5 flex items-center justify-between text-xs text-[#71717a]">
          <Link href="/privacy" className="hover:text-[#a1a1aa] transition-colors">
            Privacy promise
          </Link>
          <span>Offline-ready · On-device storage</span>
        </div>
      </div>

      {/* Right Column: Editorial Atmosphere & Visual Proof */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#121214] border-l border-white/10 flex-col justify-between p-12">
        {/* Subtle background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/landing/editorial-desk.jpg"
            alt="Editorial workspace at night"
            fill
            sizes="50vw"
            className="object-cover opacity-35 filter brightness-75 contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080809] via-transparent to-[#080809]/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080809] via-transparent to-transparent" />
        </div>

        {/* Content over image */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-black/60 backdrop-blur-md text-xs font-mono text-zinc-300">
            <Sparkles className="size-3 text-[#a3ff12]" />
            Privacy by design
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <blockquote className="text-xl sm:text-2xl font-light text-white tracking-tight leading-snug">
            &ldquo;You don&apos;t need another subscription service to inspect your own habits and productivity.&rdquo;
          </blockquote>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono">
              <Database className="size-4 text-[#a3ff12] shrink-0" />
              <span>Local client: code runs in your browser</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono">
              <ShieldCheck className="size-4 text-[#a3ff12] shrink-0" />
              <span>Full control to export or wipe data anytime</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-300 font-mono">
              <Lock className="size-4 text-[#a3ff12] shrink-0" />
              <span>Connectors store API keys strictly in local secure vault</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-zinc-400 border-t border-white/10 pt-4">
          <span>Swiss precision</span>
          <span>Open formats</span>
        </div>
      </div>
    </div>
  );
}
