import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { composeRefs, resolveRenderProps } from "@/components/ui/base-ui-utils";
import { cn } from "@/lib/utils";

const PopoverAnchorContext = React.createContext<{
  anchor: HTMLElement | null;
  setAnchor: (anchor: HTMLElement | null) => void;
} | null>(null);

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  return (
    <PopoverAnchorContext.Provider value={{ anchor, setAnchor }}>
      <PopoverPrimitive.Root data-slot="popover" {...props} />
    </PopoverAnchorContext.Provider>
  );
}

function PopoverTrigger({
  asChild = false,
  render,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  const resolved = resolveRenderProps(render, asChild, children);

  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      render={resolved.renderElement}
      {...props}
    >
      {resolved.children}
    </PopoverPrimitive.Trigger>
  );
}

type PopoverContentProps = React.PropsWithChildren<
  {
    className?: string;
    align?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["align"];
    sideOffset?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["sideOffset"];
  } & Omit<
    React.ComponentProps<typeof PopoverPrimitive.Positioner>,
    "children" | "className" | "align" | "sideOffset"
  > &
    Omit<React.ComponentProps<typeof PopoverPrimitive.Popup>, "children" | "className">
>;

function PopoverContent({
  className,
  align = "center",
  side,
  sideOffset = 4,
  children,
  ...props
}: PopoverContentProps) {
  const anchorContext = React.useContext(PopoverAnchorContext);

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="z-[90]"
        align={align}
        anchor={anchorContext?.anchor}
        {...(side !== undefined && { side })}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-[90] w-72 origin-(--popup-transform-origin) rounded-3xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--popover)_94%,transparent)] p-4 text-popover-foreground shadow-[0_24px_60px_rgba(0,0,0,0.3)] outline-hidden backdrop-blur-xl",
            "transition-[opacity,transform] duration-180 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  asChild = false,
  render,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean;
  render?: React.ReactElement;
}) {
  const anchorContext = React.useContext(PopoverAnchorContext);
  const resolved = resolveRenderProps(render, asChild, children);

  return useRender({
    defaultTagName: "div",
    render: resolved.renderElement,
    ref: composeRefs<HTMLElement>((node) => anchorContext?.setAnchor(node)),
    props: {
      "data-slot": "popover-anchor",
      children: resolved.children,
      ...props,
    },
  });
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <div data-slot="popover-title" className={cn("font-medium", className)} {...props} />;
}

function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
};
