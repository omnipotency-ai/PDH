import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const RESPONSIVE_SHELL_MD_BREAKPOINT_PX = 768;
const RESPONSIVE_SHELL_XL_BREAKPOINT_PX = 1280;

type ResponsiveShellMode = "mobile" | "tablet" | "desktop";

function getResponsiveShellMode(width: number): ResponsiveShellMode {
  if (width >= RESPONSIVE_SHELL_XL_BREAKPOINT_PX) return "desktop";
  if (width >= RESPONSIVE_SHELL_MD_BREAKPOINT_PX) return "tablet";
  return "mobile";
}

function getResponsiveShellModeFromQueries(
  desktopMatches: boolean,
  tabletMatches: boolean,
): ResponsiveShellMode {
  if (desktopMatches) return "desktop";
  if (tabletMatches) return "tablet";
  return "mobile";
}

export function useResponsiveShellMode(): ResponsiveShellMode {
  const [mode, setMode] = useState<ResponsiveShellMode>(() =>
    typeof window === "undefined" ? "mobile" : getResponsiveShellMode(window.innerWidth),
  );

  useEffect(() => {
    const mqlMd = window.matchMedia(`(min-width: ${RESPONSIVE_SHELL_MD_BREAKPOINT_PX}px)`);
    const mqlXl = window.matchMedia(`(min-width: ${RESPONSIVE_SHELL_XL_BREAKPOINT_PX}px)`);
    const handler = () => {
      setMode(getResponsiveShellModeFromQueries(mqlXl.matches, mqlMd.matches));
    };
    handler();
    mqlMd.addEventListener("change", handler);
    mqlXl.addEventListener("change", handler);
    return () => {
      mqlMd.removeEventListener("change", handler);
      mqlXl.removeEventListener("change", handler);
    };
  }, []);

  return mode;
}

export interface ResponsiveShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  drawerContentClassName?: string;
  dialogContentClassName?: string;
  sheetContentClassName?: string;
}

export function ResponsiveShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  bodyClassName,
  drawerContentClassName,
  dialogContentClassName,
  sheetContentClassName,
}: ResponsiveShellProps) {
  const mode = useResponsiveShellMode();

  if (mode === "mobile") {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} modal>
        <DrawerContent className={drawerContentClassName}>
          <DrawerHeader className="relative pr-10">
            <DrawerTitle className="text-lg">{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
            <DrawerClose className="absolute top-0 right-0 rounded-xl border border-transparent p-2 text-[var(--text-muted)] transition-[background-color,border-color,color,opacity] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/35 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </DrawerHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  const body = (
    <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
  );

  if (mode === "desktop") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className={cn("gap-0 p-0", sheetContentClassName)}>
          <SheetHeader className="gap-1 border-b pr-12">
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[70] bg-black/52 backdrop-blur-[2px] transition-opacity duration-220 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-[80] flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_97%,transparent)] shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl focus:outline-none transition-[transform,opacity] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] data-[starting-style]:translate-y-[-46%] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-[-46%] data-[ending-style]:opacity-0",
            dialogContentClassName,
          )}
        >
          <div className="relative border-b px-4 py-4 pr-12">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-[var(--text-muted)]">
                {description}
              </DialogPrimitive.Description>
            ) : null}
            <DialogPrimitive.Close className="absolute top-3 right-3 rounded-xl border border-transparent p-2 text-[var(--text-muted)] transition-[background-color,border-color,color,opacity] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/35 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          {body}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
