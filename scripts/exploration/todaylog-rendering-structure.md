# TodayLog Rendering Structure - Complete Analysis

## Overview

TodayLog.tsx implements a sophisticated grouping and rendering system for different log types. Each log type has its own rendering pattern.

---

## Log Type Grouping Strategy

The `groupLogEntries()` function (lines 85-175) categorizes logs into display types:

1. **Individual Items**: Food & Digestion → rendered as single `LogEntry` components
2. **Fluid Group**: All fluid entries → grouped into `FluidGroupRow` with expandable sub-rows
3. **Habits**: Split into two categories:
   - **Counter Habits** → `CounterHabitRow` (expandable)
   - **Event Habits** → `EventHabitRow` (single-row, inline edit)
4. **Activities**: Split by type (walk/sleep) → `ActivityGroupRow` (expandable)

---

## 1. FOOD ENTRIES - Individual Rendering

**Type**: `LogEntry` component (lines 356-833)
**Group Kind**: `"individual"` (line 95)

### Row Display (Non-Editing State)

```
div.log-entry (lines 517-831)
├── dot [h-2 w-2 rounded-full] (line 519)
├── Icon [h-4 w-4] (line 522)
└── div.min-w-0.flex-1 (content wrapper)
    ├── span.title [sm font-semibold] (line 750-752)
    │   └── getLogTitle(food) = first item formatted via formatItemDisplay()
    │       Example: "2 eggs" or "Cereal"
    ├── p.detail [mt-0.5 text-xs truncate] (line 754-756)
    │   └── getLogDetail(food) = 2nd-3rd items comma-separated
    │       Example: "1 banana, 1 glass milk"
    ├── p.notes [mt-0.5 line-clamp-2 italic] (line 757-760)
    │   └── Shows log.data.notes if present
    └── p.timestamp [mt-0.5 font-mono text-xs opacity-60] (line 762-763)
        └── format(timestamp, "HH:mm")
```

**getLogTitle() for Food** (lines 248-250):

- Takes first item from `log.data.items[0]`
- Formats via `formatItemDisplay()`: `${qty}${unit} ${name}`

**getLogDetail() for Food** (lines 275-284):

- Takes items [1-2] from items array
- Formats each via `formatItemDisplay()`
- Joins with ", "
- Returns `null` if ≤1 item (no detail shown)

**formatItemDisplay()** (lines 227-238):

```javascript
// Input: { name, quantity?, unit? }
// Output: "quantity unit name" or "name"
if (!qty || qty <= 0) return name;
if (unit) return `${qty}${unit} ${name}`; // e.g. "100g bread"
return `${qty} ${name}`; // e.g. "2 eggs"
```

### Food Editing State (lines 525-595)

- Time input: `<input type="time">` (line 528-533)
- Per-item editing grid (lines 536-582):
  ```
  For each draftItems[i]:
    └── flex gap-1
        ├── Input[quantity] w-14
        ├── Input[unit] w-12
        ├── Input[name] flex-1
        └── X button (delete if multiple items)
  ```
- Notes textarea (lines 688-694)

---

## 2. WEIGHT ENTRIES - Individual Rendering

**Type**: `LogEntry` component (same as food)
**Group Kind**: `"individual"` (line 95)

### Row Display (Non-Editing State)

```
div.log-entry (lines 517-831)
├── dot [h-2 w-2 rounded-full] (line 519)
│   └── TYPE_DOT_COLOR["weight"] = "var(--section-weight)"
├── Icon: Scale [h-4 w-4] (line 522)
│   └── color = getLogColor(weight) = "text-[var(--section-weight)]"
└── div.min-w-0.flex-1
    ├── span.title [text-sm font-semibold] (line 750-752)
    │   └── getLogTitle(weight) = `${kg.toFixed(1)} kg`
    │       (lines 268-269)
    ├── p.detail [mt-0.5 text-xs] (line 754-756)
    │   └── getLogDetail(weight) = notes if present, else null
    │       (lines 314-315)
    ├── p.notes [mt-0.5 line-clamp-2 italic] (line 757-760)
    │   └── log.data.notes if present
    └── p.timestamp [mt-0.5 font-mono text-xs] (line 762-763)
        └── format(timestamp, "HH:mm")
```

**getLogTitle() for Weight** (lines 267-269):

```javascript
const kg = Number(log.data?.weightKg);
return Number.isFinite(kg) ? `${kg.toFixed(1)} kg` : "Weigh-in";
```

**getLogDetail() for Weight** (lines 314-315):

```javascript
const notes = String(log.data?.notes ?? "").trim();
return notes || null;
```

### Weight Editing State

- Time input (line 528-533)
- NO primary field editing (food/fluid only)
- Notes textarea (line 688-694)

---

## 3. FLUID ENTRIES - Grouped Row Rendering

**Type**: `FluidGroupRow` component (lines 1430-1505)
**Group Kind**: `"fluid"` (lines 99-100, 134-139)

### Group Header (Collapsed State)

```
button.w-full.text-left (lines 1454-1485)
├── dot [h-2 w-2] (line 1460)
│   └── backgroundColor: "#38bdf8"
├── Icon: Droplets [h-4 w-4] (line 1462)
│   └── "text-sky-600 dark:text-sky-400"
├── div.min-w-0.flex-1
│   ├── span [text-sm font-semibold] (line 1464-1465)
│   │   └── "Fluids" (hardcoded)
│   └── p.detail [mt-0.5 truncate font-mono text-xs] (line 1468-1474)
│       └── "{HH:mm}  {latestName}  {qty}{unit}"
│           (from latest entry, or empty if no entries)
└── div.right-side
    ├── span.badge [font-mono text-sm font-bold] (line 1478-1479)
    │   └── "{totalL}L" (sum of all fluids in mL → L)
    └── ChevronDown [animated rotation] (line 1481-1482)
```

### Expanded State - Sub-rows

```
motion.div (lines 1489-1502)
└── div.ml-[2.75rem].space-y-1.pb-2.pr-3
    └── For each entry (slice 1, skip first):
        └── <FluidSubRow /> (lines 1497-1498)
```

### FluidSubRow Component (lines 839-973)

#### Non-Editing Display

```
div.group/entry [px-2 py-1 hover:bg-muted] (line 940)
├── span [font-mono text-xs] (line 941-946)
│   └── "{HH:mm}  {name}  {qty}{unit}"
│       Example: "14:30  Water  500ml"
└── div.opacity-0.group-hover/entry:opacity-100
    ├── Edit button [pencil icon] (line 949-960)
    └── Delete button [trash icon] (line 962-969)
```

#### FluidSubRow Editing

```
div.flex.items-center.gap-1 [px-2 py-1] (line 891)
├── Input[time] w-[4.5rem]
├── Input[name/fluid-type] flex-1
├── Input[quantity] w-14
├── span "ml" [text-xs]
├── Check button (save)
└── X button (cancel)
```

**Data Mapping**:

- `first = entry.data.items[0]`
- `origName = first?.name ?? entry.data.fluidType ?? "Fluid"`
- `origQty = Number(first?.quantity)`
- On save: `unit: "ml"` (hardcoded)

---

## 4. DIGESTION ENTRIES - Individual Rendering

**Type**: `LogEntry` component (lines 356-833)
**Group Kind**: `"individual"` (line 94)

### Row Display (Non-Editing, Collapsed)

```
button.flex.w-full.text-left (lines 698-719)
├── span [text-sm font-semibold truncate] (line 703-705)
│   └── "Bowel movement" (getLogTitle)
├── BristolBadge [code] (line 706)
│   └── If bristolCode present
├── span.accident [text-xs font-semibold text-red-400] (line 707-709)
│   └── "accident" if present
├── span.timestamp [ml-auto font-mono text-xs] (line 710-712)
│   └── format(timestamp, "HH:mm")
└── ChevronDown [animated] (line 713-718)
```

### Expanded Detail View

```
motion.div (lines 721-745)
└── div.space-y-0.5.text-xs
    ├── p "Episodes: {X}  Bristol: B{code}"
    ├── p "Urgency: {tag}  Effort: {tag}  Volume: {tag}"
    └── p.notes [italic] if notes present
```

**getLogTitle() for Digestion** (line 256):

- Returns "Bowel movement" (hardcoded)

**getLogDetail() for Digestion** (lines 293-300):

```javascript
const episodes = Number(log.data?.episodesCount) || 1;
const bristol = log.data?.bristolCode ? `B${log.data.bristolCode}` : null;
const urgency = log.data?.urgencyTag ?? null;
// Build: ["1x", "B4", "low"]
// Return: "1x · B4 · low"
return parts.join(" · ");
```

### Digestion Editing State (lines 596-685)

```
div.space-y-2
├── Bristol buttons [1-7] (line 600-613)
├── Episodes input + Accident toggle (line 615-634)
├── Urgency buttons (low/medium/high/immediate) (line 636-650)
├── Effort buttons (none/some/hard/urgent-release) (line 652-666)
├── Volume buttons (small/medium/large/juices) (line 668-682)
└── Notes textarea (line 688-694)
```

---

## 5. HABIT ENTRIES - Grouped Row Rendering

### A. COUNTER HABITS - CounterHabitRow (lines 1221-1299)

**Group Kind**: `"counter_habit"` (lines 154-158)
**Grouping Logic**: Collected by `habitId` in map (lines 104-112)

#### Header (Always Visible)

```
button.w-full.text-left [px-3 py-2.5] (lines 1248-1278)
├── dot [h-2 w-2] (line 1253-1257)
│   └── backgroundColor: "var(--section-habits)"
├── Icon [h-4 w-4] (line 1259)
│   └── From getHabitIcon(habitConfig)
├── div.min-w-0.flex-1
│   ├── span [text-sm font-semibold truncate] (line 1261-1262)
│   │   └── HABIT_DISPLAY_LABELS[groupKey] or habit.name
│   └── p.timestamp [mt-0.5 font-mono text-xs] (line 1265-1267)
│       └── format(latest.timestamp, "HH:mm")
└── div.right-side
    ├── span.badge [font-mono text-sm font-bold] (line 1271-1272)
    │   └── String(group.entries.length)
    └── ChevronDown [animated] (line 1274-1276)
```

#### Expanded State - Sub-rows

```
motion.div (lines 1282-1295)
└── div.ml-[2.75rem].space-y-1.pb-2.pr-3
    └── For each entry (slice 1, skip first):
        └── <HabitSubRow /> (lines 1290-1291)
```

#### HabitSubRow Component (lines 1124-1217)

**Display** (Non-Editing):

```
div.group/entry [px-2 py-1 hover:bg-muted] (line 1190)
├── span [font-mono text-xs] (line 1191-1192)
│   └── "{HH:mm}"
└── div.opacity-0.group-hover/entry:opacity-100
    ├── Edit button (time only) (line 1195-1204)
    └── Delete button (line 1206-1213)
```

**Editing**:

```
div.flex.items-center.gap-1 [px-2 py-1] (line 1160)
├── Input[time] w-[4.5rem]
├── Check button (save)
└── X button (cancel)
```

**Notes**: Habit entries only allow time editing, no data field editing.

---

### B. EVENT HABITS - EventHabitRow (lines 1303-1426)

**Group Kind**: `"event_habit"` (lines 146-151)
**Grouping Logic**: Filtered via EVENT_HABIT_IDS (line 144)

#### Single-Row Format (Always Visible, Never Expands)

```
div.flex.items-start.gap-3 [px-3 py-2.5] (line 1348)
├── dot [h-2 w-2] (line 1350-1353)
│   └── backgroundColor: "var(--section-habits)"
├── Icon [h-4 w-4] (line 1355)
│   └── From getHabitIcon(habitConfig)
├── div.min-w-0.flex-1
│   ├── span [text-sm font-semibold truncate] (line 1357-1358)
│   │   └── HABIT_DISPLAY_LABELS[groupKey] or habit.name
│   ├── p.timestamp [mt-0.5 font-mono text-xs] (line 1361-1362)
│   │   └── format(latest.timestamp, "HH:mm") if not editing
│   └── div.mt-1.flex.items-center.gap-1 (line 1366-1391)
│       └── Time input (only if editing)
└── div.right-side
    ├── div.check-badge [h-5 w-5 bg-section-log text-white] (line 1395-1396)
    │   └── Check icon (always visible)
    └── Buttons (edit/delete, hidden if editing) (line 1398-1422)
```

**Key Difference**: Event habits show a checkmark badge, not a count. No expansion. Always show latest timestamp inline.

---

## 6. ACTIVITY ENTRIES - Grouped Row Rendering

**Type**: `ActivityGroupRow` component (lines 1510-1610)
**Group Kind**: `"activity"` (lines 162-170)
**Grouping Logic**: Split by `activityType` ("walk" or "sleep")

### Group Header

```
button.w-full.text-left [px-3 py-2.5] (lines 1547-1582)
├── dot [h-2 w-2] (line 1552-1556)
│   └── backgroundColor: "var(--section-activity)"
├── Icon [h-4 w-4] (line 1558)
│   └── Moon (sleep) or Footprints (walk)
├── div.min-w-0.flex-1
│   ├── span [text-sm font-semibold] (line 1560-1561)
│   │   └── "Sleep" or "Walks"
│   └── p.timestamp [mt-0.5 font-mono text-xs] (line 1564-1569)
│       └── "{HH:mm}  {duration}"
│           Example: "09:00  8h 30m" or "14:00  25m"
└── div.right-side
    ├── span.badge [font-mono text-sm font-bold] (line 1573-1574)
    │   └── Sleep: total hours/mins; Walks: count
    └── ChevronDown [animated] if count > 1 (line 1576-1580)
        └── No chevron if single entry
```

### Expanded State - Sub-rows (Only if count > 1)

```
motion.div (lines 1587-1607)
└── div.ml-[2.75rem].space-y-1.pb-2.pr-3
    └── For each entry (slice 1, skip first):
        └── <ActivitySubRow /> (lines 1595-1602)
```

#### ActivitySubRow Component (lines 977-1120)

**Display** (Non-Editing):

```
div.group/entry [px-2 py-1 hover:bg-muted] (line 1092)
├── span [font-mono text-xs] (line 1093-1095)
│   └── "{HH:mm}  {duration}"
│       Sleep: "09:00  8h 30m"
│       Walk: "14:00  25m"
└── div.opacity-0.group-hover/entry:opacity-100
    ├── Edit button (line 1098-1107)
    └── Delete button (line 1109-1116)
```

**Editing**:

```
div.flex.flex-wrap.items-center.gap-1 [px-2 py-1] (line 1036)
├── Input[time] w-[4.5rem]
├── Input[duration] w-14
│   placeholder: "hrs" (sleep) or "mins" (walk)
│   step: 0.5 (sleep) or 1 (walk)
├── span [text-xs] "hrs" or "min"
├── (Walk only) Buttons [good, tired, painful] (line 1054-1068)
├── Check button (save)
└── X button (cancel)
```

**formatDuration()** (lines 331-337):

```javascript
// Sleep: "8h 30m" or "8h"
// Walk: "25m"
if (type === "sleep") {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
return `${minutes}m`;
```

---

## Row Structure Summary Table

| Log Type                  | Rendering                         | Grouping        | Edit Behavior                | Key Fields                                                    |
| ------------------------- | --------------------------------- | --------------- | ---------------------------- | ------------------------------------------------------------- |
| **Food**                  | LogEntry (individual)             | None            | Full item editing            | items[], notes                                                |
| **Weight**                | LogEntry (individual)             | None            | Time + notes only            | weightKg, notes                                               |
| **Digestion**             | LogEntry (individual)             | None            | Bristol, episodes, tags      | bristolCode, episodesCount, urgency, effort, volume, accident |
| **Fluid**                 | FluidGroupRow + FluidSubRow       | By type         | Time + name + qty            | items[0], unit: "ml"                                          |
| **Habit (Counter)**       | CounterHabitRow + HabitSubRow     | By habitId      | Time only                    | timestamp                                                     |
| **Habit (Event)**         | EventHabitRow (single)            | By habitId      | Time only                    | timestamp                                                     |
| **Activity (Walk/Sleep)** | ActivityGroupRow + ActivitySubRow | By activityType | Time + duration, feel (walk) | durationMinutes, feelTag (walk)                               |

---

## Key CSS Classes Used

- `.log-entry` - Individual log container (lines 517-831)
- `.group/entry` - Sub-row hover effect wrapper (lines 940, 1092, 1190)
- `.opacity-0.group-hover/entry:opacity-100` - Hide buttons until hover
- `.ml-[2.75rem]` - Indent for sub-rows (icon width accommodation)
- `.divide-y.divide-[var(--section-log-border)]` - Row separator (line 1707)
- `.font-mono.text-xs.opacity-60` - Timestamp styling
- `.section-log` / `.section-log-muted` - Color tokens

---

## Icon/Color Mappings

**getLogIcon()** (lines 200-212):

- food → Soup
- fluid → Droplets
- digestion → HeartPulse
- weight → Scale
- activity (walk) → Footprints
- activity (sleep) → Moon

**getLogColor()** (lines 214-225):

- food → `text-[var(--section-food)]`
- fluid → `text-sky-600 dark:text-sky-400`
- digestion → `text-[var(--section-bowel)]`
- weight → `text-[var(--section-weight)]`
- activity (sleep) → `text-indigo-600 dark:text-indigo-400`
- activity (walk) → `text-teal-600 dark:text-teal-400`

---

## Notes on Flexibility

The current pattern that fluids/activities/habits follow (group header + sub-rows) is the **correct format to follow** for any UI improvements:

1. **Grouped rows** have a collapsible header showing aggregated info
2. **Sub-rows** are only shown when expanded
3. **Latest entry** is shown in group header
4. **Indentation** via `.ml-[2.75rem]` maintains visual hierarchy
5. **Hover actions** (edit/delete) appear on hover in sub-rows

This pattern provides:

- Compact default view
- Detailed expandable view
- Consistent interaction model
- Clean visual hierarchy
