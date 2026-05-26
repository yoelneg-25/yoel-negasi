"use client";

import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { GithubIcon, LinkedinIcon, TwitterXIcon } from "@/components/SocialIcons";
import { siteConfig } from "@/lib/data";

export default function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="relative border-t border-white/[0.06] px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <span className="font-display font-semibold text-sm gradient-text">
            {siteConfig.name}
          </span>
          <span className="text-white/20 text-xs hidden sm:block">·</span>
          <span className="text-white/30 text-xs hidden sm:block">
            Senior Full Stack Engineer · Oakland, CA
          </span>
        </div>

        {/* Social */}
        <div className="flex items-center gap-3">
          {[
            { icon: GithubIcon, href: siteConfig.github, label: "GitHub" },
            { icon: LinkedinIcon, href: siteConfig.linkedin, label: "LinkedIn" },
          ].filter((s) => s.href).map(({ icon: Icon, href, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="p-2 rounded-lg text-white/30 hover:text-white/70 transition-colors"
            >
              <Icon size={16} />
            </a>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <span className="text-white/20 text-xs">
            © {new Date().getFullYear()} Yoel Negasi
          </span>
          <motion.button
            onClick={scrollToTop}
            className="p-2 rounded-lg glass border border-white/[0.08] text-white/40 hover:text-white hover:border-violet-500/30 transition-all"
            whileHover={{ y: -2 }}
            aria-label="Back to top"
          >
            <ArrowUp size={14} />
          </motion.button>
        </div>
      </div>
    </footer>
  );
}
