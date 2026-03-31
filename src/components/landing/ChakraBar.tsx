import { CHAKRA_SEQUENCE } from "@/lib/chakraColors";

interface ChakraBarProps {
  className?: string;
  height?: number;
}

export function ChakraBar({ className, height = 2 }: ChakraBarProps) {
  return (
    <div
      className={className}
      style={{
        height: `${height}px`,
        background: `linear-gradient(90deg, ${CHAKRA_SEQUENCE.join(", ")})`,
      }}
      aria-hidden="true"
    />
  );
}
