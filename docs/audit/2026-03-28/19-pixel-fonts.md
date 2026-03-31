I now have a comprehensive picture. Let me compile the final analysis.

---

## WQ-357 Research: Hardcoded Pixel Font Sizes

### Instance Counts

| Pattern | Total Instances | Files Affected |
|---|---|---|
| `text-[10px]` | **214** | 62 files |
| `text-[11px]` | **103** | 51 files |
| **Combined** | **317** | **81 unique files** (32 use both) |

For comparison, the standard Tailwind text scale usage:

| Token | Size | Instances | Files |
|---|---|---|---|
| `text-xs` | 12px | 309 | 95 files |
| `text-sm` | 14px | 330 | 84 files |
| `text-base` | 16px | 234 | 82 files |
| `text-lg` | 18px | 25 | 13 files |

There are also 13 additional arbitrary pixel sizes (`text-[12px]`, `text-[13px]`, `text-[14px]`, etc.) across 11 files, but these are minor.

### Existing Theme Configuration

There is **no custom font-size scale** defined anywhere. The `@theme inline` blocks in `/Users/peterjamesblizzard/projects/caca_traca/src/index.css` define only fonts (display, sans, mono), radii, and color tokens. No `tailwind.config.ts` or `tailwind.config.js` exists (Tailwind v4 uses CSS-based config). No `font-size`, `text-2xs`, or `text-3xs` utilities exist.

Four hardcoded `font-size` values exist in the CSS itself (`0.6875rem`, `0.7rem`, `13px` x2) but these are in component-specific rules, not utilities.

### Usage Pattern Analysis

The two sizes fill distinct semantic roles:

**`text-[10px]` (214 instances) -- two major usage camps:**

1. **Transit map / data chrome** (~40 instances, 15 files): `font-mono text-[10px] uppercase tracking-[0.2em]` -- section labels, station metadata, chip text on the transit map and database views. These are intentionally tiny for dense data displays.

2. **Form labels and helper text** (~100+ instances, 38+ files): `text-[10px] text-[var(--text-faint)]` or `text-[10px] text-[var(--text-muted)]` -- used on `<Label>` elements, validation errors, descriptive paragraphs, and status badges throughout settings forms and track panels. This is the bulk of instances.

3. **Badges and chips** (~21 instances, 16 files): `text-[10px] font-semibold` in status badges, zone chips, category labels.

**`text-[11px]` (103 instances) -- two major usage camps:**

1. **Transit map section headers** (~27 instances, 7 files): `font-mono text-[11px] uppercase tracking-[0.18em]` -- slightly larger than 10px section labels. These are a design-intentional half-step.

2. **Descriptive text and links** (~32 instances, 23 files): `text-[11px] font-semibold` used for small headings and prominent captions in settings, Dr. Poo section, AI insights, quick capture tiles.

### Design Language Alignment

The design skill at `/Users/peterjamesblizzard/projects/caca_traca/.claude/skills/caca-traca-design-language/SKILL.md` defines this typography hierarchy (line 236-243):

- **Label/caption**: 11-12px, regular or medium, `text-tertiary`
- **Chip text**: 12-13px, medium

This validates that **11px is an intentional design token** for labels/captions. The 10px usage is below even the design spec's smallest stated size, but it is clearly used for data-dense chrome (transit map) and compact form labels.

### Proposal

**Define two custom utilities rather than normalize to `text-xs`.**

Rationale:
- The design language explicitly calls out 11-12px for labels/captions. 10px is used for an even denser tier.
- Normalizing 214 instances of `text-[10px]` to `text-xs` (12px) would increase the text size by **20%**, which would visually break dense data views (transit map, database tables, settings forms with many fields). The compact sizing is intentional in those contexts.
- Normalizing 103 instances of `text-[11px]` to `text-xs` (12px) is closer (~9% increase) but would still shift the visual weight of labels and captions that were deliberately sized smaller than body text.

**Proposed custom scale -- add to the `@theme inline` block in `/Users/peterjamesblizzard/projects/caca_traca/src/index.css`:**

```css
@theme inline {
  --text-2xs: 0.6875rem;    /* 11px — labels, captions, small headings */
  --text-3xs: 0.625rem;     /* 10px — data chrome, compact form labels */
}
```

This creates `text-2xs` (11px) and `text-3xs` (10px) as first-class Tailwind utilities, eliminating all arbitrary values while preserving the visual design.

### Impact Assessment: What Would Change If We Normalized to `text-xs`

| Area | Files | Instances | Visual Impact |
|---|---|---|---|
| Transit map (all components) | 14 | ~55 | **HIGH** -- labels, chips, station metadata would grow noticeably; map density would degrade |
| Settings forms (labels, helpers) | ~25 | ~100 | **MEDIUM** -- form labels and hints would be larger; less visual hierarchy distinction from body text |
| Database views (table chrome) | 6 | ~15 | **HIGH** -- table metadata and badges would be larger in already tight rows |
| Track panels / today log | ~15 | ~40 | **MEDIUM** -- timestamps, sub-labels, validation messages would be slightly larger |
| Dr. Poo / AI sections | 8 | ~25 | **LOW-MEDIUM** -- section headers and captions would shift |
| Landing / archive | 6 | ~15 | **LOW** -- minor visual shift |

Conclusion: normalizing to `text-xs` everywhere is **not recommended**. The two sub-12px sizes serve real information hierarchy needs.

### Migration Plan

**Batch replace -- safe for both sizes.**

Both `text-[10px]` and `text-[11px]` are used consistently as literal class strings in JSX `className` props. There are no dynamic construction patterns that would break a find-and-replace.

**Steps:**
1. Add the `--text-2xs` and `--text-3xs` theme tokens to `src/index.css`
2. Global find-and-replace: `text-[11px]` -> `text-2xs` (103 instances, 51 files)
3. Global find-and-replace: `text-[10px]` -> `text-3xs` (214 instances, 62 files)
4. Run `bun run format` (Biome will reformat touched files)
5. Run `bun run typecheck` and `bun run build` to verify
6. Visual spot-check a few key screens: transit map, settings, track panels

The only file that could need case-by-case review is `src/lib/foodDigestionMetadata.ts` (1 instance of `text-[10px]` in a class string constant), but it is still a simple string literal and will work with find-and-replace.

**Estimated effort:** ~30 minutes for the full migration including verification.