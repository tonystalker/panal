"use client";

import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppMonogram } from "@/components/ui/AppMonogram";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between p-6 sm:p-10 bg-[#080809] text-[#f7f7f8] selection:bg-[#a3ff12]/20 selection:text-[#a3ff12]">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <AppMonogram size="sm" />
          <span className="text-sm font-semibold tracking-tight text-white group-hover:text-[#a3ff12] transition-colors">
            Personal Analytics
          </span>
        </Link>
        <span className="text-[11px] font-mono tracking-widest text-[#a1a1aa] uppercase px-2 py-0.5 rounded border border-white/10 bg-[#121214]">
          404 · Not Found
        </span>
      </header>

      {/* Main 404 Visual Content */}
      <main className="my-auto max-w-lg mx-auto text-center py-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-[#121214] text-xs font-mono text-[#a1a1aa] mb-6">
          <Compass className="size-3.5 text-[#a3ff12]" />
          Unmapped Route
        </div>

        <h1
          className="text-7xl sm:text-9xl font-mono font-bold tracking-tighter text-transparent select-none mb-4"
          style={{
            WebkitTextStroke: "1px rgba(163, 255, 18, 0.35)",
            textShadow: "0 0 40px rgba(163, 255, 18, 0.15)",
          }}
        >
          404
        </h1>

        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-3">
          Page not found
        </h2>

        <p className="text-sm text-[#a1a1aa] leading-relaxed mb-8">
          The view or route you requested does not exist or has moved. Your local tracking logs and settings remain safe and untouched in your browser.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            className="w-full sm:w-auto bg-[#a3ff12] text-[#0a0a0b] hover:bg-[#a3ff12]/90 font-medium text-xs h-10 px-6 shadow-sm"
          >
            <Link href="/today">
              <ArrowLeft className="size-3.5 mr-2" />
              Go to Today
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto border-white/10 bg-[#121214] text-white hover:bg-white/5 font-medium text-xs h-10 px-6"
          >
            <Link href="/">
              Return to landing page
            </Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-[#71717a] font-mono border-t border-white/5 pt-4">
        Personal Analytics · Local-first daily operating system
      </footer>
    </div>
  );
}
