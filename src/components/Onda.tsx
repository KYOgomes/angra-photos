import { cn } from "@/lib/utils";

/** Onda que faz a transição do mar (hero) para a areia (galeria). */
export function Onda({ className, cor = "var(--sand)" }: { className?: string; cor?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={cn("pointer-events-none block h-10 w-full sm:h-16", className)}
    >
      <path
        d="M0 64c120-22 240-34 360-26s240 34 360 34 240-30 360-38 240 8 360 22v64H0z"
        fill="var(--aqua)"
        opacity="0.35"
      />
      <path d="M0 88c160-26 320-34 480-20s320 36 480 30 320-34 480-28v50H0z" fill={cor} />
    </svg>
  );
}
