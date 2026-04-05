import { motion } from "framer-motion";

interface RoleCardProps {
  icon: string;
  title: string;
  description: string;
  color: string;
  delay: number;
}

export default function RoleCard({ icon, title, description, color, delay }: RoleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border p-7 ${color} card-hover cursor-default group relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300 w-12 h-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center">{icon}</div>
      <h3 className="font-semibold text-lg text-foreground tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">{description}</p>
    </motion.div>
  );
}
