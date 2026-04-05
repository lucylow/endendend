import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeatureCardProps {
  feature: {
    title: string;
    description: string;
    icon: LucideIcon;
    gradient: string;
  };
  index: number;
  active?: boolean;
  onActivate?: () => void;
}

export function FeatureCard({ feature, index, active, onActivate }: FeatureCardProps) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="group cursor-default will-change-transform"
      onMouseEnter={onActivate}
      onFocus={onActivate}
    >
      <div
        className={cn(
          "p-6 sm:p-8 rounded-3xl transition-all duration-500 will-change-transform",
          "border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl",
          "hover:border-teal-500/25 hover:shadow-xl hover:shadow-teal-500/[0.06]",
          active && "border-teal-500/35 ring-1 ring-teal-400/20 bg-white/[0.05]",
        )}
      >
        <div
          className={cn(
            "w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg",
            "bg-gradient-to-br transition-transform duration-500 group-hover:scale-105",
            feature.gradient,
          )}
        >
          <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-white/95" strokeWidth={1.75} aria-hidden />
        </div>

        <div className="text-center space-y-3">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground group-hover:text-white transition-colors">
            {feature.title}
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
