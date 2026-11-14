import { motion } from "motion/react";

import { cn } from "@/utils/cn";

type FilmRollProps = {
  dailyLimit: number;
  usedDay: number;
  reservedDay: number;
  className?: string;
};

/**
 * Representación del rollo del día. No es una cámara funcional: solo muestra
 * cuántas exposiciones quedan. La captura real vive en `CameraUpload`.
 */
export function FilmRoll({ dailyLimit, usedDay, reservedDay, className }: FilmRollProps) {
  const exposed = Math.min(usedDay + reservedDay, dailyLimit);

  return (
    <div className={cn("film-strip", className)} aria-hidden="true">
      <div
        className="grid gap-1.5 px-1 py-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(1.4rem, 1fr))" }}
      >
        {Array.from({ length: dailyLimit }, (_, index) => {
          const isExposed = index < exposed;

          return (
            <motion.span
              key={index}
              initial={false}
              animate={{ opacity: 1 }}
              className={cn(
                "relative aspect-[3/4] rounded-[1px] border",
                isExposed ? "border-paper/25 bg-paper/15" : "border-paper/30 bg-paper/80",
              )}
            >
              <span
                className={cn(
                  "absolute inset-x-1 bottom-1 h-px",
                  isExposed ? "bg-paper/25" : "bg-ink/15",
                )}
              />
              {isExposed ? (
                <span className="absolute inset-0 grid place-items-center font-mono text-[0.55rem] uppercase tracking-[0.08em] text-paper/55">
                  {index + 1}
                </span>
              ) : null}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}
