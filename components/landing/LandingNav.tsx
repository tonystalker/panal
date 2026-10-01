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
        {/* Brand Lockup */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group outline-none rounded-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label="Panal — Personal analytics, local-first"
        >
          <AppMonogram size="sm" />
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold tracking-tight text-foreground leading-none group-hover:text-accent transition-colors">
              Panal
            </span>
            <span className="text-[10px] text-muted-foreground tracking-tight leading-tight mt-0.5">
              Personal analytics, local-first
            </span>
          </div>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground" aria-label="Main navigation">
          <a
            href="#product"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Product
          </a>
          <a
            href="#story"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            How it works
          </a>
          <a
            href="#features"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Connectors
          </a>
          <a
            href="#privacy"
            className="hover:text-foreground transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Privacy
          </a>
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors rounded-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Log in
          </Link>
          <Link
            href="/today"
            id="hero-start-locally-nav"
            className="btn btn-primary btn-sm text-xs font-semibold px-3.5 h-8 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <span>Start locally</span>
            <ArrowRightIcon className="size-3" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="md:!hidden flex items-center justify-center size-8 rounded-md border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label="Toggle mobile menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-menu"
        >
          {mobileMenuOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden border-b border-border bg-surface/95 backdrop-blur-xl px-4 py-5 flex flex-col gap-4 animate-in fade-in duration-150"
        >
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
              Start locally, it’s free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
