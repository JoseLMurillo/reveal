import { cn } from "@/utils/cn";

export type VintageButtonVariant = "primary" | "accent" | "ghost" | "danger";
export type VintageButtonSize = "md" | "lg";

const base =
  "focus-film inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-4 py-3 font-sans text-body-sm font-semibold tracking-[0.01em] transition-[background-color,color,box-shadow,border-color] duration-200 ease-film disabled:pointer-events-none disabled:opacity-45";

const variants: Record<VintageButtonVariant, string> = {
  primary:
    "border-ink bg-ink text-paper-raised shadow-card hover:border-brown hover:bg-brown active:shadow-press",
  accent:
    "border-yellow bg-yellow text-ink shadow-card hover:border-[#d9a92f] hover:bg-[#d9a92f] active:shadow-press",
  ghost:
    "border-brown/50 bg-transparent text-ink hover:border-brown hover:bg-cream/60 active:shadow-press",
  danger:
    "border-red bg-red text-paper-raised shadow-card hover:border-[#883a30] hover:bg-[#883a30] active:shadow-press",
};

const sizes: Record<VintageButtonSize, string> = {
  md: "min-h-11 text-body-sm",
  lg: "min-h-12 px-6 py-3.5 text-body",
};

export function vintageButtonStyles(
  options: {
    variant?: VintageButtonVariant;
    size?: VintageButtonSize;
    className?: string;
  } = {},
): string {
  return cn(
    base,
    variants[options.variant ?? "primary"],
    sizes[options.size ?? "md"],
    options.className,
  );
}
