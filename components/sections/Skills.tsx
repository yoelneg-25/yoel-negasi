"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Monitor, Server, Cloud, Brain, Workflow, Database } from "lucide-react";
import { skills } from "@/lib/data";
import { cn } from "@/lib/utils";

type SkillCategoryData = (typeof skills)[number];

const iconMap: Record<string, React.ElementType> = {
  Monitor,
  Server,
  Cloud,
  Brain,
  Workflow,
  Database,
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

function SkillCategoryCard({
  category,
  index,
}: {
  category: SkillCategoryData;
  index: number;
}) {
  const Icon = iconMap[category.icon] ?? Monitor;
  const catRef = useRef<HTMLDivElement>(null);
  const catInView = useInView(catRef, { once: true, margin: "-40px" });
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  return (
    <motion.div
      ref={catRef}
      initial={{ opacity: 0, y: 40 }}
      animate={catInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" as const }}
      className="glass rounded-2xl p-6 hover:border-violet-500/20 transition-all duration-300 group"
    >
      {/* Category header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
          <Icon size={16} className="text-violet-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-sm text-white">
            {category.category}
          </h3>
          <p className="text-[11px] text-white/30">{category.description}</p>
        </div>
      </div>

      {/* Skills list */}
      <div className="space-y-2">
        {category.items.map((skill) => (
          <div
            key={skill.name}
            className={cn(
              "relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-default transition-all duration-200",
              hoveredSkill === skill.name
                ? "bg-violet-500/10 border border-violet-500/20"
                : "border border-transparent hover:bg-white/[0.04]"
            )}
            onMouseEnter={() => setHoveredSkill(skill.name)}
            onMouseLeave={() => setHoveredSkill(null)}
          >
            <span className="text-sm text-white/70 font-medium">{skill.name}</span>
            <motion.span
              initial={{ opacity: 0, x: 5 }}
              animate={
                hoveredSkill === skill.name
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: 5 }
              }
              className="text-[10px] text-violet-400 font-medium text-right leading-tight max-w-[120px]"
            >
              {skill.context}
            </motion.span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Skills() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="skills" className="relative section-padding px-6">
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
              Skills
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display font-bold text-4xl sm:text-5xl text-white tracking-tight mb-4"
          >
            Tools of the trade.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/40 text-base max-w-lg">
            Deep expertise across the full engineering stack — frontend, backend,
            infrastructure, and AI.
          </motion.p>
        </motion.div>

        {/* Skill categories grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {skills.map((category, catIdx) => (
            <SkillCategoryCard
              key={category.category}
              category={category}
              index={catIdx}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
