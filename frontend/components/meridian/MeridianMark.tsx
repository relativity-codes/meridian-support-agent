type MeridianMarkProps = {
  size?: "sm" | "md";
  /** Use `lg` for compact chat row avatars. */
  rounding?: "xl" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-[10px] font-bold",
  md: "h-10 w-10 text-base font-bold",
} as const;

const roundingClasses = {
  xl: "rounded-xl",
  lg: "rounded-lg",
} as const;

/** Simple lettermark until marketing provides a logo asset. */
export default function MeridianMark({
  size = "md",
  rounding = "xl",
  className = "",
}: MeridianMarkProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-meridian-600 text-white shadow-sm ring-1 ring-meridian-700/20 dark:bg-meridian-500 dark:ring-meridian-400/25 ${roundingClasses[rounding]} ${sizeClasses[size]} ${className}`}
      aria-hidden
    >
      M
    </span>
  );
}
