"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { projects } from "@/lib/data";
import { cn } from "@/lib/utils";

type Project = (typeof projects)[number];

const colorMap: Record<string, string> = {
  violet: "from-violet-600/20 to-violet-900/5 border-violet-500/20",
  indigo: "from-indigo-600/20 to-indigo-900/5 border-indigo-500/20",
  purple: "from-purple-600/20 to-purple-900/5 border-purple-500/20",
  fuchsia: "from-fuchsia-600/20 to-fuchsia-900/5 border-fuchsia-500/20",
  cyan: "from-cyan-600/20 to-cyan-900/5 border-cyan-500/20",
  orange: "from-orange-600/20 to-orange-900/5 border-orange-500/20",
  emerald: "from-emerald-600/20 to-emerald-900/5 border-emerald-500/20",
  teal: "from-teal-600/20 to-teal-900/5 border-teal-500/20",
};

const accentMap: Record<string, string> = {
  violet: "text-violet-400 bg-violet-500/10",
  indigo: "text-indigo-400 bg-indigo-500/10",
  purple: "text-purple-400 bg-purple-500/10",
  fuchsia: "text-fuchsia-400 bg-fuchsia-500/10",
  cyan: "text-cyan-400 bg-cyan-500/10",
  orange: "text-orange-400 bg-orange-500/10",
  emerald: "text-emerald-400 bg-emerald-500/10",
  teal: "text-teal-400 bg-teal-500/10",
};

const tagBgMap: Record<string, string> = {
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  indigo: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
  cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  orange: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  teal: "bg-teal-500/10 text-teal-300 border-teal-500/20",
};

function ProjectCard({
  project,
  onClick,
  index,
}: {
  project: Project;
  onClick: () => void;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <Link href={`/projects/${project.id}`}>
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative group cursor-pointer rounded-2xl border bg-gradient-to-br glass overflow-hidden transition-all duration-300 hover:-translate-y-1",
        colorMap[project.color]
      )}
      whileHover={{ scale: 1.005 }}
    >
      {/* Glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      <div className="relative p-6 sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border",
                  tagBgMap[project.color]
                )}
              >
                {tag}
              </span>
            ))}
          </div>
          <motion.div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            whileHover={{ rotate: 45 }}
          >
            <ArrowUpRight size={18} className="text-white/40" />
          </motion.div>
        </div>

        {/* Name */}
        <h3 className="font-display font-bold text-xl sm:text-2xl text-white mb-1 tracking-tight">
          {project.name}
        </h3>
        <p className={cn("text-xs font-semibold mb-3", accentMap[project.color].split(" ")[0])}>
          {project.tagline}
        </p>
        <p className="text-white/50 text-sm leading-relaxed mb-5 line-clamp-3">
          {project.description}
        </p>

        {/* Tech stack */}
        <div className="flex flex-wrap gap-1.5">
          {project.tech.slice(0, 5).map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.07] text-xs text-white/50 font-mono"
            >
              {t}
            </span>
          ))}
          {project.tech.length > 5 && (
            <span className="px-2 py-0.5 rounded-md bg-white/[0.03] text-xs text-white/30 font-mono">
              +{project.tech.length - 5}
            </span>
          )}
        </div>
      </div>
    </motion.div>
    </Link>
  );
}

function ProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border border-white/[0.08]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 z-10 p-2 rounded-lg glass hover:bg-white/[0.08] transition-colors text-white/60 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="p-7 sm:p-8">
            {/* Tags */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border",
                    tagBgMap[project.color]
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>

            <h2 className="font-display font-bold text-3xl text-white tracking-tight mb-1">
              {project.name}
            </h2>
            <p className={cn("text-sm font-semibold mb-5", accentMap[project.color].split(" ")[0])}>
              {project.tagline}
            </p>

            <p className="text-white/60 text-sm leading-relaxed mb-6">
              {project.longDescription}
            </p>

            {/* Highlights */}
            <div className="mb-6">
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-white/40 mb-3">
                Key Outcomes
              </h4>
              <ul className="space-y-2.5">
                {project.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 text-sm text-white/60">
                    <CheckCircle2 size={15} className="text-violet-400 mt-0.5 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tech stack */}
            <div className="mb-6">
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-white/40 mb-3">
                Tech Stack
              </h4>
              <div className="flex flex-wrap gap-2">
                {project.tech.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/60 font-mono"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>


          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Projects() {
  const [selected, setSelected] = useState<Project | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  const featured = projects.filter((p) => p.featured);
  const secondary = projects.filter((p) => !p.featured);

  return (
    <section id="projects" className="relative section-padding px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div ref={headerRef}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="mb-3"
          >
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-violet-400">
              Projects
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display font-bold text-4xl sm:text-5xl text-white tracking-tight mb-4"
          >
            Enterprise systems
            <br />
            <span className="gradient-text">built at scale.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-white/40 text-base max-w-xl mb-12"
          >
            Platform engineering, automation systems, and developer tooling built inside large organizations.
          </motion.p>
        </div>

        {/* Featured projects — 2 col */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {featured.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => setSelected(p)}
              index={i}
            />
          ))}
        </div>

        {/* Secondary projects — 3 col */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {secondary.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => setSelected(p)}
              index={i + 2}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <ProjectModal project={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
