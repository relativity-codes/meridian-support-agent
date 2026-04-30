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
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-meridian-600 to-meridian-800 text-white shadow-md shadow-meridian-600/25 dark:from-meridian-500 dark:to-meridian-700 ${roundingClasses[rounding]} ${sizeClasses[size]} ${className}`}
      aria-hidden
    >
      M
    </span>
  );
}
