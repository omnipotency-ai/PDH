import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PhoneFrameProps {
  children?: ReactNode;
  className?: string;
  glowColor?: string;
}

export function PhoneFrame({ children, className, glowColor }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-[260px] rounded-[2.5rem] border-[3px] bg-[#0a0f1a] p-2 shadow-2xl",
        className,
      )}
      style={{
        borderColor: glowColor ? `${glowColor}40` : "rgba(255,255,255,0.1)",
        boxShadow: glowColor ? `0 0 20px ${glowColor}25, 0 0 40px ${glowColor}10` : undefined,
      }}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#0a0f1a]" />
      {/* Screen */}
      <div className="relative overflow-hidden rounded-[2rem] bg-[#080c14]">
        <div className="aspect-[9/19.5]">
          {children ?? (
            <div className="flex h-full items-center justify-center">
              <div className="h-full w-full animate-shimmer" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
