"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppMonogram } from "@/components/ui/AppMonogram";
import { MenuIcon, XIcon, ArrowRightIcon } from "lucide-react";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border/80 py-3 shadow-lg"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group outline-none">
          <AppMonogram size="sm" />
          <span className="text-sm font-semibold tracking-tight text-foreground group-hover:text-accent transition-colors">
            Personal Analytics
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground px-1.5 py-0.5 rounded border border-border/60 bg-surface/50 hidden sm:inline-block">
            Local-First
          </span>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
          <a href="#product" className="hover:text-foreground transition-colors">
            Product
          </a>
          <a href="#story" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="#features" className="hover:text-foreground transition-colors">
            Connectors
          </a>
          <a href="#privacy" className="hover:text-foreground transition-colors">
            Privacy
          </a>
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/today"
            id="hero-start-locally-nav"
            className="btn btn-primary btn-sm text-xs font-semibold px-3.5 h-8 flex items-center gap-1.5"
          >
            <span>Start locally</span>
            <ArrowRightIcon className="size-3" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="md:hidden btn-icon size-8 text-muted-foreground hover:text-foreground"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-surface/95 backdrop-blur-xl px-4 py-5 flex flex-col gap-4 animate-in fade-in duration-150">
          <nav className="flex flex-col gap-3 text-sm font-medium text-muted-foreground">
            <a
              href="#product"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-foreground transition-colors"
            >
              Product
            </a>
            <a
              href="#story"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-foreground transition-colors"
            >
              How it works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-foreground transition-colors"
            >
              Connectors
            </a>
            <a
              href="#privacy"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-foreground transition-colors"
            >
              Privacy
            </a>
          </nav>
          <div className="flex flex-col gap-2 pt-3 border-t border-border/60">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-ghost btn-sm text-xs justify-center"
            >
              Log in
            </Link>
            <Link
              href="/today"
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-primary btn-sm text-xs justify-center"
            >
              Start locally — it’s free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
