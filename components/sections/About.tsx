"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
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

const focusAreas = [
  "Full Stack Architecture",
  "Platform Engineering",
  "Workflow Automation",
  "CI/CD Systems",
  "AI-Assisted Engineering",
  "Cloud Infrastructure",
  "Enterprise Tooling",
  "Developer Experience",
  "Scalable Systems",
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
              Outside of engineering work, I focus on how AI tools like GitHub Copilot and Claude
              can be integrated into real workflows in ways that are practical — faster reviews,
              smarter automation, better internal tooling — without losing the craft of engineering.
            </motion.p>
          </div>

          {/* Right — focus area badges */}
          <motion.div variants={stagger} className="flex flex-wrap gap-2.5">
            {focusAreas.map((area, i) => (
              <motion.span
                key={area}
                variants={fadeUp}
                custom={i}
                whileHover={{ scale: 1.04, y: -2 }}
                transition={{ duration: 0.18 }}
                className="inline-flex items-center px-4 py-2 rounded-full glass border border-violet-500/15 text-sm text-white/70 font-medium hover:border-violet-500/40 hover:text-white hover:bg-violet-500/[0.08] transition-all duration-200 cursor-default"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 mr-2 shrink-0" />
                {area}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
