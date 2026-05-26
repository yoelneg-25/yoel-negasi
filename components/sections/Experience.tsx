"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { experience } from "@/lib/data";
import { cn } from "@/lib/utils";

type Job = (typeof experience)[number];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

function ExperienceItem({ job, index }: { job: Job; index: number }) {
  const itemRef = useRef<HTMLDivElement>(null);
  const itemInView = useInView(itemRef, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, x: -20 }}
      animate={itemInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" as const }}
      className="relative pl-12"
    >
      <div
        className={cn(
          "absolute left-0 top-1.5 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
          job.current
            ? "bg-violet-500/20 border border-violet-500/50 glow-violet-sm"
            : "bg-white/[0.04] border border-white/[0.1]"
        )}
      >
        {job.current ? (
          <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-white/20" />
        )}
      </div>

      <div className="glass rounded-2xl p-6 hover:border-white/[0.1] transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
          <div>
            <h3 className="font-display font-semibold text-white text-base leading-tight">
              {job.title}
            </h3>
            <p className="text-violet-400 text-sm font-medium mt-0.5">{job.company}</p>
          </div>
          <span className="text-xs text-white/30 font-mono shrink-0">{job.period}</span>
        </div>
        <p className="text-white/50 text-sm leading-relaxed mb-4">{job.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {job.tech.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-white/40 font-mono"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function Experience() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="experience" className="relative section-padding px-6">
      <div className="max-w-4xl mx-auto" ref={ref}>
        <motion.div
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="mb-14"
        >
          <motion.div variants={fadeUp} className="mb-3">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-violet-400">
              Experience
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display font-bold text-4xl sm:text-5xl text-white tracking-tight mb-4"
          >
            Career timeline.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/40 text-base max-w-lg">
            5+ years building production systems across enterprise organizations.
          </motion.p>
        </motion.div>

        <div className="relative">
          <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-violet-500/40 via-violet-500/20 to-transparent" />
          <div className="space-y-10">
            {experience.map((job, i) => (
              <ExperienceItem key={job.id} job={job} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
