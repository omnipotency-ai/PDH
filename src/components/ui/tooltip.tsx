import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import { resolveRenderProps } from "@/components/ui/base-ui-utils";
import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider> & {
  delayDuration?: number;
}) {
  return (
    <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delayDuration} {...props} />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  asChild = false,
  render,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & {
  asChild?: boolean;
  render?: React.ReactElement;
}) {
  const resolved = resolveRenderProps(render, asChild, children);

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      render={resolved.renderElement}
      {...props}
    >
      {resolved.children}
    </TooltipPrimitive.Trigger>
  );
}

type TooltipContentProps = React.PropsWithChildren<
  {
    className?: string;
    sideOffset?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["sideOffset"];
  } & Omit<
    React.ComponentProps<typeof TooltipPrimitive.Positioner>,
    "children" | "className" | "sideOffset"
  > &
    Omit<React.ComponentProps<typeof TooltipPrimitive.Popup>, "children" | "className">
>;

function TooltipContent({ className, sideOffset = 6, children, ...props }: TooltipContentProps) {
  const { side, align, ...popupProps } = props;

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        className="z-[95]"
        {...(align !== undefined && { align })}
        {...(side !== undefined && { side })}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-[95] w-fit max-w-[40ch] origin-(--popup-transform-origin) rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-2)_94%,transparent)] px-2.5 py-1.5",
            "font-sans text-xs leading-snug font-medium tracking-normal text-[var(--text-muted)] wrap-break-word shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-md",
            "transition-[opacity,transform] duration-150 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...popupProps}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
