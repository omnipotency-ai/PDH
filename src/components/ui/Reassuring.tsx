import type { SVGProps } from "react";

type ReassuringCoachProps = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

export function ReassuringCoach({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  ...props
}: ReassuringCoachProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5z" />
      <path d="M16 22a4 4 0 0 0-4-4 4 4 0 0 0-4 4" />
      <path d="M18 10a8 8 0 0 1-6 8c-3.3 0-6-2.7-6-6" />
      <path d="M6 10s-1 1-1 2 1 2 1 2" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
