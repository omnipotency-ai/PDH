Perfect. Now I have all the information I need. Let me summarize the findings:

## Research Report: WQ-321 Sparkline Gradient ID Break

### Broken Code

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/hero/Sparkline.tsx`

**Lines 81 and 125** contain the broken gradient ID generation:

```typescript
// Line 81 (gradient definition)
<linearGradient id={`fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">

// Line 125 (gradient reference)
fill={`url(#fill-${color.replace("#", "")})`}
```

**Problem:** The `.replace("#", "")` sanitization only removes the `#` character. When callers pass CSS variable values like `var(--section-summary)`, the result is `var(--section-summary)`. The SVG `id` and `url()` then become:
- **Gradient ID:** `fill-var(--section-summary)` — invalid because parentheses and parentheses in SVG IDs must match `[a-zA-Z_][a-zA-Z0-9_:.-]*` (spec allows only alphanumeric, underscore, colon, period, hyphen; no parentheses)
- **URL reference:** `url(#fill-var(--section-summary))` — the nested parentheses break CSS `url()` parsing

Additionally, all instances share the same gradient ID when the same CSS variable is passed, creating a single shared gradient instead of isolated instances.

### All Callers & Color Values

**Both callers pass CSS variables:**

1. **File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/hero/BristolTrendTile.tsx`
   - **Line 192:** `color="var(--section-summary)"`

2. **File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/hero/BmFrequencyTile.tsx`
   - **Line 124:** `color="var(--section-summary)"`

Both use the **same CSS variable**, which means they currently share a single gradient definition.

### Exact Fix Needed

Create a sanitization function that converts color values to valid SVG ID characters. The function should:

1. Strip `#` from hex values
2. Replace invalid characters `(`, `)`, `-` in CSS variable syntax with safe alphanumeric/hyphen characters
3. Ideally include a hash or unique counter to ensure each instance gets a unique gradient ID (preventing ID collisions)

**Sanitization function:**

```typescript
/** Sanitize color string to valid SVG ID characters [a-zA-Z0-9-] */
function sanitizeColorForId(color: string): string {
  // Remove # from hex colors
  let sanitized = color.replace("#", "");
  // Replace any character that's not alphanumeric or hyphen with nothing
  // This handles: var(--section-summary) → varsectionsummary
  sanitized = sanitized.replace(/[^a-zA-Z0-9-]/g, "");
  return sanitized;
}
```

Or with a **counter-based approach** (prevents collisions even with identical colors):

```typescript
let idCounter = 0;

function sanitizeColorForId(color: string): string {
  const base = color.replace("#", "").replace(/[^a-zA-Z0-9-]/g, "");
  return `${base}-${++idCounter}`;
}
```

The counter approach is safer because:
- Each Sparkline instance gets a unique ID even if two components pass the same color
- Avoids potential gradient reuse across different component instances
- Works for both hex colors and CSS variables