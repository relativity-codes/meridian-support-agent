type MeridianMarkProps = {
  size?: "sm" | "md" | "lg";
  /** Use `lg` for compact chat row avatars. */
  rounding?: "xl" | "lg" | "2xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs font-bold",
  md: "h-12 w-12 text-xl font-extrabold",
  lg: "h-20 w-20 text-3xl font-black",
} as const;

const roundingClasses = {
  "2xl": "rounded-[1.25rem]",
  xl: "rounded-xl",
  lg: "rounded-lg",
} as const;

/** Premium lettermark for the Meridian brand. */
export default function MeridianMark({
  size = "md",
  rounding = "xl",
  className = "",
}: MeridianMarkProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/30 ${roundingClasses[rounding]} ${sizeClasses[size]} ${className}`}
      aria-hidden
    >
      M
    </span>
  );
}
