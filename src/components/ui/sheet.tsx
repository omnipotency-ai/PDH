import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { resolveRenderProps } from "@/components/ui/base-ui-utils";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  asChild = false,
  render,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  const resolved = resolveRenderProps(render, asChild, children);

  return (
    <SheetPrimitive.Trigger data-slot="sheet-trigger" render={resolved.renderElement} {...props}>
      {resolved.children}
    </SheetPrimitive.Trigger>
  );
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Backdrop>) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-[70] bg-black/52 backdrop-blur-[2px] transition-opacity duration-220 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Popup> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-[80] flex flex-col gap-4 overflow-hidden border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_97%,transparent)] shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-[transform,opacity] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          side === "right" &&
            "inset-y-0 right-0 h-full w-[min(34rem,92vw)] border-l data-[starting-style]:translate-x-10 data-[ending-style]:translate-x-10",
          side === "left" &&
            "inset-y-0 left-0 h-full w-[min(34rem,92vw)] border-r data-[starting-style]:-translate-x-10 data-[ending-style]:-translate-x-10",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[starting-style]:-translate-y-10 data-[ending-style]:-translate-y-10",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[starting-style]:translate-y-10 data-[ending-style]:translate-y-10",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xl border border-transparent p-2 text-[var(--text-muted)] transition-[background-color,border-color,color,opacity] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--ring)]/35 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
