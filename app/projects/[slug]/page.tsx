"use client";

import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronRight, Zap } from "lucide-react";
import { projects } from "@/lib/data";

const colorMap: Record<string, string> = {
  violet: "from-violet-600/20 via-violet-600/5 to-transparent",
  indigo: "from-indigo-600/20 via-indigo-600/5 to-transparent",
  purple: "from-purple-600/20 via-purple-600/5 to-transparent",
  fuchsia: "from-fuchsia-600/20 via-fuchsia-600/5 to-transparent",
  cyan: "from-cyan-600/20 via-cyan-600/5 to-transparent",
  orange: "from-orange-600/20 via-orange-600/5 to-transparent",
  emerald: "from-emerald-600/20 via-emerald-600/5 to-transparent",
  teal: "from-teal-600/20 via-teal-600/5 to-transparent",
};

const accentMap: Record<string, string> = {
  violet: "text-violet-400",
  indigo: "text-indigo-400",
  purple: "text-purple-400",
  fuchsia: "text-fuchsia-400",
  cyan: "text-cyan-400",
  orange: "text-orange-400",
  emerald: "text-emerald-400",
  teal: "text-teal-400",
};

const borderMap: Record<string, string> = {
  violet: "border-violet-500/30",
  indigo: "border-indigo-500/30",
  purple: "border-purple-500/30",
  fuchsia: "border-fuchsia-500/30",
  cyan: "border-cyan-500/30",
  orange: "border-orange-500/30",
  emerald: "border-emerald-500/30",
  teal: "border-teal-500/30",
};

const bgMap: Record<string, string> = {
  violet: "bg-violet-500/10",
  indigo: "bg-indigo-500/10",
  purple: "bg-purple-500/10",
  fuchsia: "bg-fuchsia-500/10",
  cyan: "bg-cyan-500/10",
  orange: "bg-orange-500/10",
  emerald: "bg-emerald-500/10",
  teal: "bg-teal-500/10",
};

const tagBgMap: Record<string, string> = {
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  orange: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  teal: "bg-teal-500/15 text-teal-300 border-teal-500/20",
};

type ArchitectureStep = { step: string; desc: string };

type Project = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  problem?: string;
  architecture?: ArchitectureStep[];
  tech: string[];
  tags: string[];
  featured: boolean;
  color: string;
  highlights: string[];
  demoPath?: string;
};

export default function ProjectPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const project = projects.find((p) => p.id === slug) as Project | undefined;

  if (!project) notFound();

  const accent = accentMap[project.color] ?? "text-violet-400";
  const gradient = colorMap[project.color] ?? colorMap.violet;
  const border = borderMap[project.color] ?? borderMap.violet;
  const bg = bgMap[project.color] ?? bgMap.violet;
  const tagBg = tagBgMap[project.color] ?? tagBgMap.violet;

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
    }),
  };

  return (
    <main className="min-h-screen bg-[#080810] text-white">
      {/* Hero */}
      <section className={`relative pt-24 pb-20 bg-gradient-to-b ${gradient}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.06)_0%,transparent_70%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6">
          {/* Back link */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" as const }}
          >
            <Link
              href="/#projects"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-10 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to projects
            </Link>
          </motion.div>

          {/* Tags */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="flex flex-wrap gap-2 mb-5"
          >
            {project.tags.map((tag) => (
              <span
                key={tag}
                className={`text-xs px-3 py-1 rounded-full border font-medium ${tagBg}`}
              >
                {tag}
              </span>
            ))}
          </motion.div>

          {/* Title */}
          <motion.h1
            custom={1}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="font-sora text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            {project.name}
          </motion.h1>

          {/* Tagline */}
          <motion.p
            custom={2}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className={`text-xl font-medium ${accent} mb-6`}
          >
            {project.tagline}
          </motion.p>

          {/* Description */}
          <motion.p
            custom={3}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="text-white/60 text-lg leading-relaxed max-w-2xl"
          >
            {project.description}
          </motion.p>

          {/* Tech stack + demo CTA */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="flex flex-wrap items-center gap-3 mt-8"
          >
            <div className="flex flex-wrap gap-2">
            {project.tech.map((t) => (
              <span
                key={t}
                className="text-xs px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/70 font-mono"
              >
                {t}
              </span>
            ))}
            </div>

            {/* Live demo CTA — only for projects that have one */}
            {project.demoPath && (
              <Link
                href={project.demoPath}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/35 hover:border-violet-500/55 text-violet-300 text-sm font-semibold transition-all group mt-2"
              >
                <Zap size={14} />
                Try Live Demo
                <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-20">

        {/* The Problem */}
        {project.problem && (
          <motion.section
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: "easeOut" as const }}
          >
            <h2 className="font-sora text-2xl font-bold mb-6 flex items-center gap-3">
              <span className={`text-sm font-mono font-normal ${accent} opacity-70`}>01 /</span>
              The Problem
            </h2>
            <div className={`rounded-2xl border ${border} ${bg} p-8`}>
              <p className="text-white/70 text-lg leading-relaxed">{project.problem}</p>
            </div>
          </motion.section>
        )}

        {/* Architecture */}
        {project.architecture && project.architecture.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: "easeOut" as const }}
          >
            <h2 className="font-sora text-2xl font-bold mb-6 flex items-center gap-3">
              <span className={`text-sm font-mono font-normal ${accent} opacity-70`}>02 /</span>
              How It Works
            </h2>
            <div className="space-y-3">
              {project.architecture.map((node, i) => (
                <motion.div
                  key={node.step}
                  custom={i}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className={`flex items-start gap-5 rounded-xl border ${border} bg-white/[0.02] p-5 group hover:bg-white/[0.04] transition-colors`}
                >
                  <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${bg} border ${border} mt-0.5`}>
                    <ChevronRight className={`w-4 h-4 ${accent}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold font-mono ${accent} mb-1`}>{node.step}</p>
                    <p className="text-white/60 text-sm leading-relaxed">{node.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Key Outcomes */}
        <motion.section
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: "easeOut" as const }}
        >
          <h2 className="font-sora text-2xl font-bold mb-6 flex items-center gap-3">
            <span className={`text-sm font-mono font-normal ${accent} opacity-70`}>
              {project.problem ? "03" : "01"} /
            </span>
            Key Outcomes
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {project.highlights.map((h, i) => (
              <motion.div
                key={i}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className={`flex items-start gap-4 rounded-xl border ${border} bg-white/[0.02] p-5`}
              >
                <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${accent}`} />
                <p className="text-white/70 text-sm leading-relaxed">{h}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Bottom nav */}
        <div className="pt-4 border-t border-white/10">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to all projects
          </Link>
        </div>
      </div>
    </main>
  );
}
