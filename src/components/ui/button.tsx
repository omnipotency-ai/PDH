import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { resolveRenderProps } from "@/components/ui/base-ui-utils";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_12px_30px_color-mix(in_srgb,var(--primary)_26%,transparent)] hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--primary)_92%,white_8%)] hover:shadow-[0_16px_36px_color-mix(in_srgb,var(--primary)_34%,transparent)]",
        destructive:
          "bg-destructive text-white shadow-[0_12px_28px_rgba(220,38,38,0.22)] hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--destructive)_92%,white_8%)] hover:shadow-[0_16px_32px_rgba(220,38,38,0.28)]",
        outline:
          "border-border bg-background/86 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--sky)_45%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_72%,var(--background))] hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_12px_28px_color-mix(in_srgb,var(--sky)_18%,transparent)] hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--secondary)_88%,white_12%)] hover:shadow-[0_16px_34px_color-mix(in_srgb,var(--sky)_24%,transparent)]",
        ghost:
          "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--accent)_80%,transparent)] hover:text-foreground data-[popup-open]:bg-[color-mix(in_srgb,var(--accent)_90%,transparent)] data-[popup-open]:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-[11px] has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-xl px-7 text-[15px] has-[>svg]:px-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    render?: React.ReactElement;
    asChild?: boolean;
  }) {
  const resolved = resolveRenderProps(render, asChild, children);

  return (
    <BaseButton
      data-slot="button"
      data-variant={variant}
      data-size={size}
      nativeButton={resolved.renderElement === undefined}
      render={resolved.renderElement}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {resolved.children}
    </BaseButton>
  );
}

export { Button, buttonVariants };
