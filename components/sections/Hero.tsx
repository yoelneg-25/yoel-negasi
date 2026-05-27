"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, Download, MapPin } from "lucide-react";
import { GithubIcon, LinkedinIcon, TwitterXIcon } from "@/components/SocialIcons";
import { siteConfig } from "@/lib/data";

const TYPEWRITER_STRINGS = [
  "Senior Full Stack & Platform Engineer",
  "Platform & Automation Engineer",
  "CI/CD & Developer Tooling",
  "AI-Enabled Workflow Engineering",
  "Cloud Infrastructure & Systems",
];

function useTypewriter(strings: string[], speed = 80, pause = 2000) {
  const [displayed, setDisplayed] = useState("");
  const [stringIdx, setStringIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = strings[stringIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < current.length) {
      timeout = setTimeout(() => setCharIdx((c) => c + 1), speed);
    } else if (!deleting && charIdx === current.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx((c) => c - 1), speed / 2);
    } else if (deleting && charIdx === 0) {
      setDeleting(false);
      setStringIdx((i) => (i + 1) % strings.length);
    }

    setDisplayed(current.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, stringIdx, strings, speed, pause]);

  return displayed;
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function Hero() {
  const typewriterText = useTypewriter(TYPEWRITER_STRINGS);

  const scrollToProjects = () => {
    document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-16">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl w-full mx-auto text-center"
      >
        {/* Location badge */}
        <motion.div variants={item} className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-violet-500/20 text-sm text-violet-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <MapPin size={13} className="opacity-70" />
            {siteConfig.location} · Available for opportunities
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          variants={item}
          className="font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white leading-[1.05] tracking-tight mb-6"
        >
          Building systems
          <br />
          <span className="gradient-text">that scale.</span>
          <br />
          <span className="text-white/30 text-4xl sm:text-5xl md:text-6xl lg:text-7xl">Engineered faster with AI.</span>
        </motion.h1>

        {/* Typewriter subtitle */}
        <motion.div variants={item} className="h-10 mb-6 flex items-center justify-center">
          <p className="font-display text-xl sm:text-2xl text-white/40 font-medium">
            <span className="text-violet-400">{typewriterText}</span>
            <span className="animate-pulse text-violet-400">|</span>
          </p>
        </motion.div>

        {/* Bio */}
        <motion.p
          variants={item}
          className="max-w-2xl mx-auto text-base sm:text-lg text-white/50 leading-relaxed mb-10"
        >
          {siteConfig.bio}
        </motion.p>

        {/* CTAs */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <motion.button
            onClick={scrollToProjects}
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all duration-200 glow-violet-sm"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            View Projects
            <ArrowDown size={15} />
          </motion.button>
          <motion.a
            href={siteConfig.resume}
            download
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-white/10 text-white/80 hover:text-white hover:border-white/20 hover:bg-white/[0.04] font-semibold text-sm transition-all duration-200"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={15} />
            Download Resume
          </motion.a>
        </motion.div>

        {/* Social links */}
        <motion.div variants={item} className="flex items-center justify-center gap-4">
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
            aria-label="GitHub"
          >
            <GithubIcon size={18} />
          </a>
          <a
            href={siteConfig.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
            aria-label="LinkedIn"
          >
            <LinkedinIcon size={18} />
          </a>
          <a
            href={siteConfig.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
            aria-label="Twitter"
            style={{ display: siteConfig.twitter ? "block" : "none" }}
          >
            <TwitterXIcon size={18} />
          </a>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown size={16} className="text-white/20" />
        </motion.div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 hidden lg:block"
      >
        <div className="glass rounded-2xl p-5 grid grid-cols-4 gap-4">
          {[
            { value: "5+", label: "Years Experience" },
            { value: "60+", label: "CI/CD Pipelines" },
            { value: "5+", label: "Enterprise Platforms" },
            { value: "2M+", label: "Daily Events Processed" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display font-bold text-xl text-white">{stat.value}</div>
              <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
