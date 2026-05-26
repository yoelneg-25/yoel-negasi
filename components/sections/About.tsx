"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Code2, Layers, Zap, Brain } from "lucide-react";
import { siteConfig } from "@/lib/data";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const pillars = [
  {
    icon: Layers,
    title: "Full Stack Architecture",
    body: "Designing scalable systems end-to-end — from React component hierarchies to distributed Node.js backends, API design, and cloud infrastructure.",
  },
  {
    icon: Zap,
    title: "Platform & Automation",
    body: "Building the internal platforms and automation pipelines that multiply engineering team velocity — CI/CD standardization, workflow engines, and developer tooling.",
  },
  {
    icon: Code2,
    title: "Enterprise Engineering",
    body: "Navigating the complexity of large organizations — legacy modernization, compliance requirements, multi-team coordination, and production reliability at scale.",
  },
  {
    icon: Brain,
    title: "AI-Enhanced Engineering",
    body: "Embedding AI tools — GitHub Copilot, Claude, and the OpenAI API — directly into engineering workflows to accelerate delivery, improve code quality, and build smarter internal tooling. Not ML, just practical AI applied where it actually helps.",
  },
];

export default function About() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="relative section-padding px-6">
      <div className="max-w-6xl mx-auto" ref={ref}>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="grid lg:grid-cols-2 gap-16 items-center"
        >
          {/* Left — text */}
          <div>
            <motion.div variants={fadeUp} className="mb-3">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-violet-400">
                About
              </span>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="font-display font-bold text-4xl sm:text-5xl text-white leading-tight tracking-tight mb-6"
            >
              Engineering at the
              <br />
              <span className="gradient-text">intersection of scale</span>
              <br />
              and craft.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-white/50 text-base leading-relaxed mb-5"
            >
              {siteConfig.bio}
            </motion.p>
            <motion.p
              variants={fadeUp}
              className="text-white/40 text-sm leading-relaxed"
            >
              When I&apos;m not building production systems, I&apos;m exploring how AI tools like
              GitHub Copilot and Claude can be wired into real engineering workflows in ways that
              are genuinely useful — faster reviews, smarter automation, better internal tooling —
              without losing the craft of engineering.
            </motion.p>
          </div>

          {/* Right — pillar cards */}
          <motion.div
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {pillars.map((p) => (
              <motion.div
                key={p.title}
                variants={fadeUp}
                className="glass rounded-2xl p-5 hover:border-violet-500/20 transition-all duration-300 group"
                whileHover={{ y: -3 }}
              >
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                  <p.icon size={17} className="text-violet-400" />
                </div>
                <h3 className="font-display font-semibold text-sm text-white mb-2">
                  {p.title}
                </h3>
                <p className="text-xs text-white/40 leading-relaxed">{p.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
