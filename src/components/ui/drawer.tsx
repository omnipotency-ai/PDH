import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import * as React from "react";

import { resolveRenderProps } from "@/components/ui/base-ui-utils";
import { cn } from "@/lib/utils";

function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
  asChild = false,
  render,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  const resolved = resolveRenderProps(render, asChild, children);

  return (
    <DrawerPrimitive.Trigger data-slot="drawer-trigger" render={resolved.renderElement} {...props}>
      {resolved.children}
    </DrawerPrimitive.Trigger>
  );
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      onClickCapture={(event) => {
        event.stopPropagation();
        props.onClickCapture?.(event);
      }}
      className={cn(
        "fixed inset-0 z-[70] bg-black/52 backdrop-blur-[2px] transition-opacity duration-220 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Popup>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-[80] flex h-auto flex-col overflow-hidden border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_97%,transparent)] shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-[transform,opacity] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          "data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:mt-24 data-[swipe-direction=down]:max-h-[82vh] data-[swipe-direction=down]:rounded-t-[1.75rem] data-[swipe-direction=down]:border-t data-[swipe-direction=down]:data-[starting-style]:translate-y-10 data-[swipe-direction=down]:data-[ending-style]:translate-y-10",
          "data-[swipe-direction=up]:inset-x-0 data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:mb-24 data-[swipe-direction=up]:max-h-[82vh] data-[swipe-direction=up]:rounded-b-[1.75rem] data-[swipe-direction=up]:border-b data-[swipe-direction=up]:data-[starting-style]:-translate-y-10 data-[swipe-direction=up]:data-[ending-style]:-translate-y-10",
          "data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=left]:right-0 data-[swipe-direction=left]:w-[min(32rem,88vw)] data-[swipe-direction=left]:border-l data-[swipe-direction=left]:data-[starting-style]:translate-x-10 data-[swipe-direction=left]:data-[ending-style]:translate-x-10",
          "data-[swipe-direction=right]:inset-y-0 data-[swipe-direction=right]:left-0 data-[swipe-direction=right]:w-[min(32rem,88vw)] data-[swipe-direction=right]:border-r data-[swipe-direction=right]:data-[starting-style]:-translate-x-10 data-[swipe-direction=right]:data-[ending-style]:-translate-x-10",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-4 hidden h-1.5 w-16 shrink-0 rounded-full bg-[var(--border-strong)] group-data-[swipe-direction=down]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Popup>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[swipe-direction=down]/drawer-content:text-center group-data-[swipe-direction=up]/drawer-content:text-center md:gap-1.5 md:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
