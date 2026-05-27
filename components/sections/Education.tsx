"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { GraduationCap, MapPin } from "lucide-react";
import { education } from "@/lib/data";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function Education() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="education" className="relative section-padding px-6">
      <div className="max-w-4xl mx-auto" ref={ref}>
        <motion.div
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="mb-14"
        >
          <motion.div variants={fadeUp} className="mb-3">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-violet-400">
              Education
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display font-bold text-4xl sm:text-5xl text-white tracking-tight"
          >
            Academic background.
          </motion.h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4">
          {education.map((edu, i) => (
            <motion.div
              key={edu.id}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="glass rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <GraduationCap size={18} className="text-violet-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white text-base leading-tight mb-1">
                  {edu.degree}
                </h3>
                <p className="text-violet-400 text-sm font-medium">{edu.school}</p>
              </div>
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-white/30 text-xs">
                  <MapPin size={11} />
                  {edu.location}
                </div>
                <span className="text-xs text-white/30 font-mono">{edu.year}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
