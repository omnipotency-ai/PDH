import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/useMediaQuery";

const CONFIRMATION_WORD = "DELETE";

interface DeleteConfirmDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
  /** Error message to display inside the drawer on failure. */
  errorMessage?: string;
}

export function DeleteConfirmDrawer({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
  errorMessage,
}: DeleteConfirmDrawerProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const isMatch = inputValue === CONFIRMATION_WORD;

  useEffect(() => {
    if (open) {
      setInputValue("");
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleConfirm = () => {
    if (isMatch && !isDeleting) {
      onConfirm();
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDeleting && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const warningIcon = (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--destructive)]/10 ring-1 ring-[var(--destructive)]/25">
      <AlertTriangle className="h-6 w-6 text-[var(--destructive)]" />
    </div>
  );

  const titleText = "Delete all account data";

  const descriptionText =
    "This permanently removes every record linked to your account from the cloud — logs, reports, conversations, food assessments, profiles, and all AI analysis history. This action cannot be undone.";

  const confirmForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleConfirm();
      }}
    >
      <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 p-3">
        <label
          htmlFor="delete-confirm-input"
          className="block text-center text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]"
        >
          Type <span className="font-mono text-[var(--destructive)]">{CONFIRMATION_WORD}</span> to
          confirm
        </label>
        <input
          ref={inputRef}
          id="delete-confirm-input"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isDeleting}
          className="mt-2 block w-full rounded-md border border-[var(--destructive)]/25 bg-[var(--surface-0)] px-3 py-2.5 text-center font-mono text-base font-semibold tracking-[0.25em] text-[var(--text)] placeholder:text-[var(--text-faint)] placeholder:tracking-[0.25em] focus:border-[var(--destructive)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--destructive)]/30"
          placeholder={CONFIRMATION_WORD}
        />
      </div>
    </form>
  );

  const errorFeedback = errorMessage ? (
    <div
      role="alert"
      className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-center text-xs font-medium text-[var(--destructive)]"
    >
      {errorMessage}
    </div>
  ) : null;

  const actionButtons = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="destructive"
        onClick={handleConfirm}
        disabled={!isMatch || isDeleting}
        className="h-10 font-semibold tracking-wide transition-all duration-200 disabled:opacity-30"
      >
        {isDeleting ? "Deleting..." : "Permanently delete all data"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-9 text-[var(--text-muted)]"
        disabled={isDeleting}
        onClick={() => handleOpenChange(false)}
      >
        Cancel
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="border-t-2 border-[var(--destructive)]/60 bg-[var(--surface-1)]">
          <DrawerHeader className="pb-2">
            {warningIcon}
            <DrawerTitle className="mt-2 text-center font-display text-lg tracking-tight text-[var(--text)]">
              {titleText}
            </DrawerTitle>
            <DrawerDescription className="text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
              {descriptionText}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4">{confirmForm}</div>

          {errorFeedback && <div className="px-4 pt-2">{errorFeedback}</div>}

          <DrawerFooter className="gap-0 pt-3">{actionButtons}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] transition-opacity duration-220 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-3rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-[var(--destructive)]/40 bg-[var(--surface-1)] shadow-[0_0_60px_-10px_var(--destructive)] focus:outline-none transition-[opacity,transform] duration-220 ease-out data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
          <div className="h-1 w-full rounded-t-xl bg-[var(--destructive)]/70" />

          <div className="px-6 pt-5 pb-2 text-center">
            {warningIcon}
            <DialogPrimitive.Title className="mt-3 font-display text-lg font-semibold tracking-tight text-[var(--text)]">
              {titleText}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {descriptionText}
            </DialogPrimitive.Description>
          </div>

          <div className="px-6 py-3">{confirmForm}</div>

          {errorFeedback && <div className="px-6 pb-1">{errorFeedback}</div>}

          <div className="px-6 pb-5">{actionButtons}</div>

          <DialogPrimitive.Close
            className="absolute top-3 right-3 rounded-md p-1.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--destructive)]/30 disabled:pointer-events-none"
            disabled={isDeleting}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
