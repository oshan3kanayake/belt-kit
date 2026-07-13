"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export default function ModulePlaceholder({
  icon: Icon,
  title,
  eyebrow,
  description,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="font-sans text-sm uppercase tracking-[0.18em] text-rosegold-500">
        {eyebrow}
      </p>
      <h1 className="mt-2 flex items-center gap-3 font-serif text-4xl font-semibold text-burgundy-700">
        <Icon className="text-rosegold-500" size={30} />
        {title}
      </h1>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card mt-8 flex flex-col items-center justify-center gap-3 p-16 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rosegold-sheen text-white shadow-luxe">
          <Icon size={26} />
        </div>
        <h3 className="font-serif text-2xl font-semibold text-burgundy-700">
          {title} — next up
        </h3>
        <p className="max-w-md font-sans text-sm text-ink-soft">{description}</p>
      </motion.div>
    </div>
  );
}
