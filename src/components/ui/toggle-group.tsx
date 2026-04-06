import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { toggleVariants } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
});

function ToggleGroup({
  type = "multiple",
  className,
  variant,
  size,
  spacing = 0,
  children,
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.PropsWithChildren<
  Omit<
    React.ComponentProps<typeof ToggleGroupPrimitive>,
    "children" | "value" | "defaultValue" | "onValueChange" | "multiple"
  > &
    VariantProps<typeof toggleVariants> & {
      type?: "single" | "multiple";
      spacing?: number;
      value?: string | string[];
      defaultValue?: string | string[];
      onValueChange?: (value: string | string[]) => void;
    }
>) {
  const multiple = type === "multiple";
  const groupValue =
    value === undefined
      ? undefined
      : ((multiple ? (Array.isArray(value) ? value : [value]) : [value]) as string[]);
  const groupDefaultValue =
    defaultValue === undefined
      ? undefined
      : ((multiple
          ? Array.isArray(defaultValue)
            ? defaultValue
            : [defaultValue]
          : [defaultValue]) as string[]);

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      multiple={multiple}
      {...(groupValue !== undefined && { value: groupValue })}
      {...(groupDefaultValue !== undefined && {
        defaultValue: groupDefaultValue,
      })}
      {...(onValueChange && {
        onValueChange: (nextValue: string[]) =>
          onValueChange(multiple ? nextValue : (nextValue[0] ?? "")),
      })}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
