# UI Component Conventions

## Base UI Migration Patterns

This codebase uses Base UI (`@base-ui/react`) instead of Radix UI for headless components.

### Composition Rules

- `GroupLabel` must be inside `Group` (e.g., `DropdownMenuLabel` inside `DropdownMenuGroup`)
- Floating elements use Portal+Positioner+Popup composition (Radix's `Content` → Base UI's `Portal+Positioner+Popup`)
- SubContent needs its own Portal+Positioner+Popup wrapper
- Use `render` prop for polymorphism (not Radix's `asChild`)

```typescript
// Base UI polymorphism pattern
<Button render={<a href="/link" />}>Click me</Button>

// For backwards-compatible asChild support
const renderElement = render ?? (asChild && React.isValidElement(children) ? children : undefined);
```

### Data Attribute Mappings (Radix → Base UI)

| Radix                    | Base UI                                 |
| ------------------------ | --------------------------------------- |
| `data-[state=open]`      | `data-[popup-open]` (triggers)          |
| `data-[state=checked]`   | `data-[checked]`                        |
| `data-[state=unchecked]` | `data-[unchecked]`                      |
| `data-[state=active]`    | `data-[active]` (tabs)                  |
| `data-[state=on]`        | `data-[pressed]` (toggles)              |
| `data-[state=open]`      | `data-[open]` (collapsible)             |
| `data-[state=open]`      | `data-[panel-open]` (accordion trigger) |
| `--radix-*` CSS vars     | `--popup-*` CSS vars                    |

### Component Naming Conventions

Maintain Radix-compatible export names for backwards compatibility:

- `Accordion.Panel` → export as `AccordionContent`
- `Tabs.Tab` → export as `TabsTrigger`
- `Tabs.Panel` → export as `TabsContent`
- `Collapsible.Panel` → export as `CollapsibleContent`

## Libraries NOT to Replace with Base UI

These specialized libraries provide features Base UI doesn't have:

| Library                | Component | Reason                                              |
| ---------------------- | --------- | --------------------------------------------------- |
| `cmdk`                 | Command   | Uses `heading` prop on CommandGroup, not GroupLabel |
| `react-day-picker`     | Calendar  | Full date picker functionality                      |
| `embla-carousel-react` | Carousel  | Gesture-based carousel                              |
| `sonner`               | Toast     | Toast notification system                           |

## TypeScript Patterns

### exactOptionalPropertyTypes

Use conditional spread instead of passing `undefined`:

```typescript
// Good - conditional spread
...(value !== undefined && { prop: value })

// Bad - fails with exactOptionalPropertyTypes
{ prop: value } // when value could be undefined
```

### useRender Hook

Use Base UI's `useRender` hook instead of Radix's `Slot` component:

```typescript
import { useRender } from "@base-ui/react/use-render";

function MyComponent({ render, children, ...props }) {
  return useRender({
    defaultTagName: "button",
    props,
    ...(render !== undefined && { render }),
  });
}
```

## Component Structure

- Use `data-slot` attributes for CSS targeting and semantic markers
- Export from central `src/components/ui/index.ts`
- Use CVA (class-variance-authority) for variant styling
- Forward refs for component instance access
