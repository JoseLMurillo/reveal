import { cn } from "@/utils/cn";

const frames = [
  { label: "01", sky: "#D8A545", ground: "#8B5E3C", accent: "#F4EFE4" },
  { label: "02", sky: "#B86A4E", ground: "#4F5D4A", accent: "#E9E0D0" },
  { label: "03", sky: "#8E9B87", ground: "#443A2F", accent: "#E6B83F" },
  { label: "04", sky: "#C58E58", ground: "#705C48", accent: "#FFFDF8" },
];

type FilmStripProps = {
  className?: string;
};

/**
 * Ilustración decorativa del rollo. No representa fotografías reales ni datos
 * de usuario: son composiciones abstractas de color.
 */
export function FilmStrip({ className }: FilmStripProps) {
  return (
    <div className={cn("film-strip", className)} aria-hidden="true">
      <div className="grid grid-cols-2 gap-2 px-1 py-6 sm:grid-cols-4 lg:grid-cols-2">
        {frames.map((frame, index) => (
          <div
            key={frame.label}
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-[1px] border border-paper/15",
              index % 3 === 0 && "sm:rotate-[-0.6deg]",
              index % 3 === 1 && "sm:rotate-[0.4deg]",
            )}
            style={{
              background: `linear-gradient(160deg, ${frame.sky} 0%, ${frame.sky} 46%, ${frame.ground} 46%, ${frame.ground} 100%)`,
            }}
          >
            <span
              className="absolute left-1/2 top-[46%] size-10 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80"
              style={{ backgroundColor: frame.accent }}
            />
            <span
              className="absolute inset-x-0 bottom-0 h-[18%] opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0 6px, rgba(255,253,248,0.7) 6px 7px)",
              }}
            />
            <span className="absolute bottom-1.5 left-2 font-mono text-[0.55rem] tracking-[0.14em] text-paper-raised/85">
              {frame.label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-2 pb-1 pt-2 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-paper/55">
        <span>35 mm</span>
        <span>ISO 400</span>
        <span>24 exp.</span>
      </div>
    </div>
  );
}
