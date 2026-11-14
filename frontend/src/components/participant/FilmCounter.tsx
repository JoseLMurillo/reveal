import { Camera, CircleDot } from "lucide-react";

import { cn } from "@/utils/cn";

type FilmCounterProps = {
  remainingDay: number;
  dailyLimit: number;
  usedDay: number;
  reservedDay: number;
  className?: string;
};

/**
 * Contador del rollo: los disparos usados o reservados quedan velados y los
 * disponibles conservan el color del papel.
 */
export function FilmCounter({
  remainingDay,
  dailyLimit,
  usedDay,
  reservedDay,
  className,
}: FilmCounterProps) {
  const exposed = Math.min(usedDay + reservedDay, dailyLimit);
  const frames = Array.from({ length: dailyLimit }, (_, index) => index < exposed);
  const progress = dailyLimit > 0 ? (exposed / dailyLimit) * 100 : 0;

  return (
    <div className={cn("paper-card overflow-hidden", className)}>
      <div className="flex items-end justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-caption uppercase tracking-[0.14em] text-brown">
            Disponibles hoy
          </p>
          <p className="mt-1 font-display text-[2.6rem] font-semibold leading-none">
            {remainingDay}
            <span className="ml-1 font-sans text-body-sm font-normal text-muted">
              / {dailyLimit}
            </span>
          </p>
        </div>
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-full border border-brown/30 bg-cream/45 text-brown"
        >
          <Camera className="size-5" strokeWidth={1.75} />
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
          {frames.map((isExposed, index) => (
            <span
              key={index}
              className={cn(
                "h-7 w-4 rounded-[1px] border transition-colors",
                isExposed ? "border-ink/35 bg-ink/80" : "border-brown/30 bg-paper",
              )}
            />
          ))}
        </div>

        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={dailyLimit}
          aria-valuenow={exposed}
          aria-label={`${exposed} de ${dailyLimit} disparos usados`}
        >
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-500 ease-film"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 flex items-center gap-2 text-caption text-muted">
          <CircleDot aria-hidden="true" className="size-3.5" />
          {usedDay} usados
          {reservedDay > 0 ? ` · ${reservedDay} en curso` : ""}
        </p>
      </div>
    </div>
  );
}
