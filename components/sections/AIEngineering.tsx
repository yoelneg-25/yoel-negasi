"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Bot, Cpu, Wrench, Sparkles } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const capabilities = [
  {
    icon: Bot,
    title: "GitHub Copilot",
    description:
      "Daily driver for code generation, test scaffolding, refactoring, and PR documentation — integrated into every feature cycle.",
    chips: ["Code Gen", "Test Scaffolding", "PR Docs", "Refactoring"],
  },
  {
    icon: Sparkles,
    title: "Claude for System Design",
    description:
      "Use Claude as an architecture thought partner — validating design decisions, stress-testing data models, and drafting technical specs.",
    chips: ["Architecture Review", "Data Modeling", "Tech Specs", "Design Validation"],
  },
  {
    icon: Wrench,
    title: "OpenAI API Tooling",
    description:
      "Built internal tools powered by the OpenAI API — automated PR summaries, code review assistance, and runbook query interfaces.",
    chips: ["PR Summaries", "Code Review", "Runbook Search", "Internal Tools"],
  },
  {
    icon: Cpu,
    title: "Prompt Engineering",
    description:
      "Design structured, context-rich prompts for engineering tasks — code generation, documentation, incident analysis, and YAML automation.",
    chips: ["Structured Prompts", "Context Design", "YAML Automation", "Incident Analysis"],
  },
];

export default function AIEngineering() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="ai-engineering" className="relative section-padding px-6">
      <div className="max-w-6xl mx-auto" ref={ref}>
        {/* Header */}
        <motion.div
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="mb-14"
        >
          <motion.div variants={fadeUp} className="mb-3">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-violet-400">
              AI-Augmented Practice
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display font-bold text-4xl sm:text-5xl text-white tracking-tight mb-4"
          >
            Engineering with AI.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/50 text-base max-w-2xl leading-relaxed">
            AI tools aren&apos;t a separate skill set — they&apos;re embedded in how I ship. I use
            GitHub Copilot, Claude, and the OpenAI API as force multipliers across the full
            engineering lifecycle: writing, reviewing, designing, and automating.
          </motion.p>
        </motion.div>

        {/* Two-column layout: statement left, cards right */}
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Left — statement */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="lg:col-span-2 lg:sticky lg:top-28"
          >
            <div className="glass rounded-2xl p-7 border border-violet-500/15">
              {/* Glowing orb */}
              <div className="relative w-14 h-14 mb-6">
                <div className="absolute inset-0 rounded-2xl bg-violet-500/20 blur-xl" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/30 to-violet-900/20 border border-violet-500/30 flex items-center justify-center">
                  <Bot size={22} className="text-violet-400" />
                </div>
              </div>

              <h3 className="font-display font-bold text-xl text-white mb-3 leading-tight">
                AI is how I stay<br />
                <span className="gradient-text">ahead of the curve.</span>
              </h3>
              <p className="text-white/45 text-sm leading-relaxed mb-6">
                Every sprint, I leverage AI to accelerate delivery without sacrificing
                code quality — shipping faster while keeping full engineering ownership
                of every decision.
              </p>

              {/* Stat chips */}
              <div className="space-y-2.5">
                {[
                  { label: "Copilot", detail: "Used daily across all projects" },
                  { label: "Claude", detail: "Architecture & design reviews" },
                  { label: "OpenAI API", detail: "Embedded in internal tooling" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    <span className="text-sm font-semibold text-white/70">{s.label}</span>
                    <span className="text-xs text-white/30 ml-auto text-right">{s.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right — capability cards */}
          <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                  className="glass rounded-2xl p-5 hover:border-violet-500/20 transition-all duration-300 group"
                  whileHover={{ y: -2 }}
                >
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                    <Icon size={15} className="text-violet-400" />
                  </div>
                  <h4 className="font-display font-semibold text-sm text-white mb-2">
                    {cap.title}
                  </h4>
                  <p className="text-xs text-white/45 leading-relaxed mb-4">
                    {cap.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cap.chips.map((chip) => (
                      <span
                        key={chip}
                        className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/15 text-[10px] text-violet-400 font-medium"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
