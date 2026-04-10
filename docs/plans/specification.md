> **Ref:** `docs/plans/archive/specification.md`
> **Updated:** 2026-04-05
> **Version:** 1.0 (ARCHIVED)
> **History:** v1.0 (2026-04-05) — archived, superseded by individual PRDs

# Post-Anastomosis Food Reintegration Mobile App — Design Specification

## PHASE 0: Product Framing, Assumptions, and Scope

### Audience

This document is intended for the engineering team (or coding agent) building the app from scratch with no prior context. It should contain everything needed to understand the product vision, data model, user experience, technical architecture, and implementation priorities.

### Important Assumption

All healing timelines, food-stage mappings, and recommendations need to be calibrated to the user's personal rhythm as soon as statistically possible. Until then, broad general guidelines derived from published research are used as sensible defaults.
Research sources underpinning the default food zone assignments, transit timing windows, and reintroduction sequencing include:

- NHS Trust low-residue and ileostomy diet leaflets (Leeds Teaching Hospitals, Torbay, ELHT, UHS Southampton, Hull & East Yorkshire)
- UCSF and UC Davis ileostomy nutrition guides
- Bowel Cancer Australia low-fibre and ostomy diet guidance
- PMC/NCBI review on ileostomy dietary management (2025)
- Academy of Nutrition and Dietetics low-fibre handout (UPenn)
- FOWUSA (Friends of Ostomy) diet and nutrition guide
- MSKCC diet guidelines for people with an ileostomy
- Rome III criteria for Bristol Stool Scale classification
- Published transit time data for post-anastomosis and post-ileostomy-reversal patients

Full citations are maintained in the codebase at docs/research/food-zone-phase.md and docs/research/Bristol_Classification_Evidence.md.

### Disclaimer Posture

This app is **not a medical device and does not provide medical advice**

- It is a consumer wellness tool for tracking, pattern recognition, and supportive guidance during post-surgical recovery
- The app must make this clear during onboarding and in its terms of use. A registered health professional should always be consulted in case of doubt
- If the app detects health flags that could indicate a medical concern (see Safety Escalation Triggers in Phase 4), it must refuse to advise and insist the user seek medical attention from their aftercare team

### Purpose & Goals

The app should help users:

- decide what foods are most likely to be tolerated today
- reintroduce foods progressively after bowel surgery/anastomosis
- log foods, drinks, bowel outputs, and relevant modifiers with minimal effort
- understand lagged patterns between intake and bowel outcomes
- receive supportive, non-judgmental coaching
- export clear summaries that can be shared with the user's aftercare team or general practitioner

### Target Users

Primary users:

- adults recovering from bowel surgery with an anastomosis
- users after ostomy reversal
- users with variable transit and bowel output during recovery

Secondary users:

- users with an ostomy bag who want to better understand and manage the relationship between the foods they eat and their output
- clinicians, dietitians, stoma nurses, and family doctors receiving exported reports

### Core User Needs / Pain Points

- Uncertainty: “What can I eat today without making things worse?”
- Low energy / ADHD friction: typing detailed logs is hard during recovery.
- Delayed feedback: symptoms may appear hours later, making food correlation difficult.
- High sensitivity: users need supportive guidance, not shame or moralizing.
- Privacy concerns: stool/output images and bowel data are highly sensitive.
- Need for nuance: the app must still be useful with partial data.

### Inferred Non-Goals

At launch, the app should not:

- diagnose complications
- replace clinician instructions
- autonomously interpret stool images as medical diagnosis
- prescribe medications or change dosages
- use social feeds or competitive leaderboards

### Inferred Product Priorities

1. Daily “what can I eat today?” guidance
2. Fast food and output logging
3. Zone-based food library with reintroduction guidance
4. Trend analysis and food experimentation support
5. AI coach with persistent memory and report generation
6. Meal planning and shopping list generation
7. Voice/image capture and branded food support as feature-flagged or staged rollout features

### Recommended Technical Implementation Direction

- **Mobile:** React Native + Expo + TypeScript (Android first, iOS later)
- **Web:** React + Vite + TypeScript (Chrome web app version, feature parity not required at launch)
- **Backend:** Convex (database, server functions, scheduling, file storage, vector search, auth — all-in-one)
- **AI:** Convex Agent component (@convex-dev/agents) + OpenAI API (or equivalent) via Convex actions, for threaded conversations with persistent memory, tool calling, and rate limiting
- **Auth:** Clerk (already proven with Convex; Convex Auth is an alternative when stable)
- **Styling:** Tailwind CSS + shadcn/ui
- **Client state:** Zustand for ephemeral client state; Convex for all persistent state
- **Integrations (MVP):** Google Fit / Health Connect (covers Fitbit), FCM push notifications, Web Speech API for voice input
- **Integrations (later):** Apple HealthKit, APNs, barcode scanning, food image recognition
- **Admin tooling:** Optional. A simple protected internal route for managing the seed food catalog and updating recommendation defaults. Can be deferred past MVP — the Convex dashboard provides direct database access for early-stage management.

Convex is the entire backend. Background jobs (tolerance recalculation, daily insight computation, weekly digest generation, experiment check-in reminders) use Convex scheduled functions and cron jobs natively.

---

## PHASE 1: VISUAL DESIGN & USER EXPERIENCE

### 1.1 Core Design Principles

#### Progressive Disclosure

- Show one primary question or action per screen.
- Keep advanced details collapsed until requested.
- Default to a minimal logging experience, with “Add details” as optional.
- Default charts to one question + one dimension, not dense dashboards.

#### ADHD-Friendly Patterns

- One prominent CTA per screen.
- Persistent contextual header (e.g., “Week 5 after surgery”).
- Save drafts automatically.
- Use chips, buttons, and quick selections instead of long forms.
- Reuse last values and “log again” shortcuts.
- Allow partial logging without penalty.
- Avoid stacked modals and deep nesting.
- Provide “resume where you left off” behavior.

#### Non-Judgmental Interaction Design

- Use neutral language:
- “gentle option,” “test later,” “observe”
- avoid “good,” “bad,” “cheat,” “failed”
- No red failure states for missed logs.
- Streaks should be “check-in rhythms,” not punishment loops.
- Empty states should reassure: “You can start with your next meal.”

#### Purposeful Animation Guidelines

- Motion primarily for orientation, confirmation, focus, and showing progression or food groupings.
- Subtle animations are acceptable to communicate food zone progression, category grouping, or state transitions — but should always serve a functional purpose.
- Default durations:
  - 150–200 ms for taps, toggles, card expansions
  - 220–280 ms for bottom sheets and chart drill-downs
- No purely decorative autoplay motion.
- Respect system “Reduce Motion.”
- Use subtle haptics for save/complete states instead of visual noise.

#### Flexible Preferences Ladder

The app should remain useful at multiple data levels:

- Level 0: surgery details only → generic stage guidance
- Level 1: + output logs → transit/tendency guidance
- Level 2: + food logs → tolerance tracking
- Level 3: + sleep/activity/stress/medications/stimulants → richer suggestions
- Level 4: + AI interactions → proactive coaching and artifacts

### 1.2 Visual Design System

#### Layout System

- 8pt spacing system
- Minimum touch target: 44 x 44 pt
- Mobile-first single-column layout
- Tablet/desktop: 2-column layout with left nav and right details panel
- Max content width on large screens: ~720–840 px for reading comfort

#### Typography

- Use native system font stack or Inter
- Reading level target: plain-language, ideally 6th–8th grade
- Suggested scale:
- H1: 28/34 semibold
- H2: 22/28 semibold
- H3: 18/24 medium
- Body: 16–17/24 regular
- Caption: 13/18 regular

#### Core UI Components

- Stage chip: “Stage 2 — Low-Residue Expansion”
- Suggestion card: food + rationale + confidence + CTA
- Quick log bottom sheet
- Bristol selector cards (1–7)
- Insight card with plain-language answer
- Confidence badge: Low / Medium / High
- Reason pills: “based on recent outputs,” “new food,” “contains caffeine”
- Experiment timeline card
- Coach bubble with citation chips
- Urgent safety banner (rare, high-priority)

### 1.3 Information Hierarchy

#### Primary Hierarchy

1. Safety / urgent alerts
2. Today’s next best food decision
3. Quick logging actions
4. Recent outputs and trends
5. Active food experiments
6. Detailed history and reports
7. Configuration and settings

#### Navigation Structure

Recommended mobile navigation:

- Home
- Track
- Food
- Insights
- Settings

Persistent global action:

- Floating “+” quick log button available from all tabs

Desktop / tablet:

- Left rail nav
- Hover tooltips
- Sticky detail panel for trends and food detail

### 1.4 Screen Layouts and Views

#### A. Onboarding

##### Purpose

- collect enough context for useful first-day guidance

##### Steps

1. Welcome + scope disclaimer ("supportive tracking tool, not medical advice — always consult your aftercare team if in doubt")
2. Surgery details (type, date, ideally allowing user to pinpoint on a colon diagram the cuts and removed parts, or upload a diagram from their surgeon)
3. Current known restrictions or dietary instructions from their aftercare team
4. Optional profile details: sex at birth, dietary preferences, allergies/intolerances
5. Choose tracking mode: Minimal, Standard, Detailed
6. Choose coach style
7. Notification + permissions setup

##### Required onboarding data

- surgery type
- surgery date

##### Recommended but optional

- sex at birth
- dietary restrictions
- reminder preferences

#### B. Today Screen

##### Primary question

- “What can I eat today?”

##### Structure

- Header: days since surgery + active stage + confidence indicator
- Main card: 3 suggested gentle options + 1 “test later” suggestion
- Secondary cards:
  - current tendency: “faster/looser than usual,” “slower/harder than usual,” or “mixed”
  - last output summary
  - active experiment
  - hydration or meal spacing tip
- Bottom section:
  - quick add meal
  - track output
  - ask coach

##### Overview view

- short answer and 3–4 concise cards

##### Detailed view

- “Why these suggestions?”
- factors used
- current uncertainty
- linked food details

#### C. Food Library & Food Detail

##### Library functions

- search foods
- filter by:
- stage
- category
- texture
- user tolerance
- “new to me”
- “test later”
- sort by:
- most gentle now
- most used
- recent experiments
- clinician-reviewed starter foods

##### Food detail view

- compatibility for current stage
- suggested preparation/texture
- default timing guidance
- user history:
  - tried count
  - tolerance confidence
  - suspected effects
- CTA:
  - “Log this”
  - “Test this food”
  - “Ask coach about this”

#### D. Quick Log Bottom Sheet

##### Fast options

- Food / drink
- Output
- Medication
- Sleep
- Activity
- Stress
- Stimulant

##### Rules

- open in under 200 ms
- remember last-used mode
- allow text, voice, image, or form entry
- allow backdating timestamp

#### E. Output Tracking Screen

##### Primary interaction

- 7 large Bristol cards with number + label + icon
- optional photo capture
- optional voice capture
- optional detail fields

##### Collapsed default fields

- Bristol type
- timestamp

##### Expanded optional fields

- urgency
- amount
- pain
- sensation (e.g., burning, crunchy — not a pain scale; if the user is experiencing actual pain the app should direct them to contact their aftercare team)
- strain (effort)
- consecutive visits (how many BMs in this session — e.g., if the user gets up only to need to sit down again, or had a second BM shortly after, they can record it as 2 BMs)
- notes (generous text allowance or voice note that lets the user describe the experience in their own words; voice is transcribed to text and audio is automatically deleted)
- blood/mucus

#### F. Trends Screen

##### Default trend cards should answer plain-language questions

- “Am I trending looser or harder this week?”
- “How did new foods go?”
- “What tends to happen after caffeine?”
- “Which foods have been most tolerated?”

##### Overview

- 3–5 insight cards with one-sentence summaries

##### Detailed trend views

- one chart per question
- surgery date marker
- experiment markers
- tap into food-specific timelines

#### G. Coach Screen

##### Elements

- persistent chat thread
- quick prompts:
  - “Give me a gentle breakfast”
  - “Help me review a new food”
  - “Summarize my last 7 days”
  - “Create a meal plan”
- context summary pill
- memory editor entry point: “What I want you to remember”

#### H. Reports / Me

##### Functions

- export PDF (shareable via email, WhatsApp, or standard phone share options, plus print/PDF)
- export CSV
- edit profile and surgery details
- choose theme / reminders / coach style
- data retention controls
- configure minimal vs detailed mode
- data deletion and account closure

### 1.5 Interaction Patterns

#### Mobile

- Tap: primary selection
- Swipe left on log item: edit/delete
- Swipe right on log item: repeat / copy
- Double-tap food item: add to quick meal draft
- Long-press chart point: pin tooltip
- Pull down on cards: collapse details
- FAB opens last-used logging flow

#### Desktop / Web Companion

- Hover on chart points for tooltips
- Hover on suggestion cards for rationale preview
- Keyboard tab order mirrors mobile reading order
- All hover-only info must also be accessible by click/focus

### 1.6 Information Visualization Approach

#### Principle: Main Question + One Dimension

Every trend screen should begin with:

- a plain-language question
- a one-sentence answer
- one primary chart

##### Examples

- Question: “Did bananas seem to help?”
- Primary dimension: banana exposures vs next-output tendency

##### Examples of chart patterns

- Bristol over time: dot/line chart
- New foods introduced: event timeline
- Correlation by food: ranked list with confidence bars
- Stress/sleep vs tendency: simple paired trend with no dual-axis clutter by default

##### Interaction model

- tap chart point → full details
- toggle overlays one at a time
- never display more than one y-axis in default view
- include text summary above chart for accessibility

### 1.7 Accessibility Considerations

#### Accessibility Baseline

- WCAG 2.2 AA target
- Dynamic Type / scalable fonts
- VoiceOver / TalkBack support
- Full keyboard support for larger-screen layouts
- High contrast themes
- Reduced motion support
- Color-blind safe palette
- All icons labeled with text

#### Sensitive Content Accessibility

- Bristol cards should include text labels, not just imagery
- Stool photo analysis must be optional, private, and avoid mandatory image viewing
- Charts require text summaries for screen reader users

#### Cognitive Accessibility

- Limit visible choices per step
- Prefer segmented controls, chips, and plain buttons
- Use short paragraphs and bullets
- Support “simple mode” that hides trends and advanced metrics on the home screen

### 1.8 Key User Flows

#### 1. Daily Decision-Making

1. User opens Today
2. App shows stage, tendency, and 3 recommended gentle foods
3. User taps a suggestion to see “why”
4. User logs meal or starts a test food experiment
5. Optional: user asks coach for meal planning

#### 2. Food Logging

1. Tap FAB
2. Choose text, voice, image, barcode, or form
3. System parses input into meal draft
4. User confirms/edit
5. Meal is saved and insights recompute in background

#### 3. Output Tracking

1. Tap FAB or reminder
2. Choose Bristol card
3. Optionally add photo/voice/details
4. Save in under 10 seconds
5. If output suggests concern, show safety guidance

#### 4. Trend Analysis

1. Open Trends
2. Choose question card
3. Review simple summary + chart
4. Drill into food-specific or time-lag detail
5. Save insight as report or ask coach

#### 5. AI Coach Interaction

1. User asks question or taps prompt
2. Coach retrieves structured context + memory
3. Response includes explanation and cited reasoning
4. User can convert answer into artifact
   - meal plan
   - report
   - experiment plan

#### 6. Food Experimentation and Symptom Correlation

1. User marks food as “new” or “test this”
2. App suggests portion and observation windows
3. App nudges for output/symptom check-ins
4. Trend engine updates tolerance score
5. Food detail reflects “likely tolerated,” “unclear,” or “test carefully”

---

## PHASE 2: DATABASE SCHEMA DESIGN

### 2.1 Database Standards

#### Recommended stack

Convex is the backend platform — database, server functions, scheduling, vector search, and file storage in one system.

#### Convex Data Model Conventions

- Document IDs are auto-generated by Convex (\_id field, referenced via v.id("tableName"))
- All event timestamps stored as v.number() (Unix milliseconds)
- Date-only fields (surgery date, schedule fields) stored as v.string() in YYYY-MM-DD format
- Structured metadata and flexible payloads use typed v.object() with explicit validators
- Vector embeddings use Convex's built-in vectorIndex on v.array(v.float64()) fields
- Audio is transcribed to text and discarded

#### General design rules

- Separate auth identity from health profile
- Encrypt sensitive notes and media references
- Add (userId, timestamp) compound indexes on all time-series log tables
- Store derived insights separately from raw logs
- Version recommendation rules and food stage assignments rather than hardcoding them only in application logic
- Soft delete for user-facing data; hard delete for privacy/deletion requests (GDPR and CCPA compliance)
- The app is online-only. If the network is unavailable, the UI must fail clearly. The last unsubmitted entry should be held in client memory so the user can resume on reconnection.

### 2.2 Core Identity & Profile Tables

#### users

- authSubject: v.string() — unique identifier from auth provider (Clerk subject ID)
- email: v.optional(v.string()) — stored only if user provides it
- status: v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted"))
- createdAt: v.number()
- deletedAt: v.optional(v.number())

⠀Indexes: by_authSubject ["authSubject"]

#### userProfiles

- userId: v.id("users")
- displayName: v.optional(v.string())
- sexAtBirth: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("prefer_not_to_say")))
- birthYear: v.optional(v.number())
- timezone: v.string()
- locale: v.string()
- units: v.union(v.literal("metric"), v.literal("imperial_us"), v.literal("imperial_uk"))
- dietaryPreferences: v.optional(v.array(v.string())) — e.g., vegetarian, halal, gluten-free
- allergyTags: v.optional(v.array(v.string())) — e.g., dairy, nuts, shellfish
- intolerances: v.optional(v.array(v.string())) — e.g., lactose, fructose
- coachStyle: v.union(v.literal("warm_coach"), v.literal("calm_clinical"), v.literal("straight_to_the_point"), v.literal("reflective_guide"))
- trackingMode: v.union(v.literal("minimal"), v.literal("standard"), v.literal("detailed"))
- createdAt: v.number()
- updatedAt: v.number()

⠀Indexes: by_userId ["userId"]

#### userPreferences

- userId: v.id("users")
- theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system"))
- reducedMotion: v.boolean()
- highContrast: v.boolean()
- simpleHomeMode: v.boolean()
- proactiveAiEnabled: v.boolean()
- voiceCaptureEnabled: v.boolean()
- biometricLockEnabled: v.boolean()
- quietHours: v.optional(v.object({ start: v.string(), end: v.string() })) — e.g., "22:00" to "07:00"
- notificationLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("reactive_only"))
- brevityPreference: v.union(v.literal("concise"), v.literal("standard"), v.literal("detailed"))
- explanationDepth: v.union(v.literal("brief"), v.literal("moderate"), v.literal("thorough"))
- emojiEnabled: v.boolean()

⠀Indexes: by_userId ["userId"]

#### consents

- userId: v.id("users")
- consentType: v.union(v.literal("terms_of_service"), v.literal("privacy_policy"), v.literal("voice_processing"), v.literal("data_export"), v.literal("gdpr_data_processing"))
- version: v.string()
- grantedAt: v.number()
- revokedAt: v.optional(v.number())

⠀Indexes: by_userId ["userId"]

### 2.3 Surgery, Healing Stage, and Guidance Tables

#### surgeryTypes

- code: v.string() — unique identifier, e.g., "right_colectomy"
- name: v.string() — display name, e.g., "Right Colectomy / Ileocolic Anastomosis"
- anatomicalRegion: v.string()
- baselineTransitMinHours: v.number()
- baselineTransitMaxHours: v.number()
- defaultStoolBias: v.union(v.literal("loose"), v.literal("normal"), v.literal("hard"), v.literal("variable"))
- description: v.string()
- active: v.boolean()

⠀Indexes: by_code ["code"]

The onboarding flow should ideally allow the user to pinpoint on a colon diagram the cuts and removed parts, or upload a diagram from their surgeon, to improve accuracy of the surgery type selection.

#### surgeryEvents

- userId: v.id("users")
- surgeryTypeId: v.id("surgeryTypes")
- surgeryDate: v.string() — YYYY-MM-DD
- anastomosisSite: v.optional(v.union(v.literal("ileocolic"), v.literal("colocolic"), v.literal("colorectal"), v.literal("ileorectal"), v.literal("ileoanal"), v.literal("other")))
- ostomyReversal: v.boolean()
- laparoscopic: v.optional(v.boolean())
- resectionLengthCm: v.optional(v.number())
- complications: v.optional(v.array(v.string()))
- aftercareInstructions: v.optional(v.string()) — free-text notes from user about what their aftercare team told them
- stageOverrideId: v.optional(v.number()) — manual stage override if user's aftercare team has specific guidance
- createdAt: v.number()

⠀Indexes: by_userId ["userId"]

#### reintroductionStages

- id: v.number() — 0 through 4
- code: v.string() — unique, e.g., "stage_0_clear_hydrate"
- name: v.string() — e.g., "Stage 0 — Clear & Hydrate"
- minDayPostop: v.number()
- maxDayPostop: v.optional(v.number())
- description: v.string()
- defaultNewFoodIntervalHours: v.number() — minimum wait between introducing new foods
- defaultPortionGuidance: v.string()

#### foodCategories

- name: v.string()
- parentId: v.optional(v.id("foodCategories"))
- defaultStageId: v.number() — references reintroductionStages.id
- fiberBand: v.union(v.literal("very_low"), v.literal("low"), v.literal("moderate"), v.literal("high"))
- textureBand: v.union(v.literal("liquid"), v.literal("puree"), v.literal("soft"), v.literal("firm"), v.literal("hard"), v.literal("chewy"))
- riskBand: v.union(v.literal("gentle"), v.literal("moderate"), v.literal("challenging"))
- sortOrder: v.number()
- defaultGuidance: v.string()

⠀Indexes: by_name ["name"], by_defaultStageId ["defaultStageId"]

#### categoryGuidance

Surgery-type-specific overrides for food categories at specific stages.

- categoryId: v.id("foodCategories")
- surgeryTypeId: v.optional(v.id("surgeryTypes")) — null means applies to all surgery types
- stageId: v.number()
- minDaysPostop: v.number()
- maxDaysPostop: v.optional(v.number())
- portionGuidance: v.string()
- progressionRule: v.string()
- cautionText: v.optional(v.string())
- contentVersion: v.string() — versioned so guidance updates are traceable

⠀Indexes: by_categoryId ["categoryId"], by_surgeryTypeId ["surgeryTypeId"]

Surgery-specific override examples:

- Ileostomy reversal / J-pouch: delay caffeine, carbonation, spicy foods, and very sugary items
- Low anterior resection: extra caution with urgency-triggering foods, raw fibre, and large meals
- Small bowel resection: stronger hydration emphasis and caution with sugar alcohols
- User's aftercare team instructions always take precedence

Initial `surgery_types` to support:

- right colectomy / ileocolic anastomosis
- left colectomy / colorectal anastomosis
- low anterior resection
- ileostomy reversal
- colostomy reversal
- small bowel resection with anastomosis
- IPAA/J-pouch related anastomosis
- other / clinician-guided

### 2.4 Food Catalog, Branded Items, and User Foods

#### foodItems

The canonical food catalog.

- sourceType: v.union(v.literal("seed"), v.literal("community"), v.literal("user_promoted"))
- canonicalName: v.string()
- displayName: v.string()
- categoryId: v.id("foodCategories")
- defaultStageId: v.number()
- defaultMinDaysPostop: v.number()
- defaultPortionG: v.optional(v.number())
- textureBand: v.union(v.literal("liquid"), v.literal("puree"), v.literal("soft"), v.literal("firm"), v.literal("hard"), v.literal("chewy"))
- fiberBand: v.union(v.literal("very_low"), v.literal("low"), v.literal("moderate"), v.literal("high"))
- gasRisk: v.union(v.literal("none"), v.literal("low"), v.literal("moderate"), v.literal("high"))
- fatBand: v.union(v.literal("very_low"), v.literal("low"), v.literal("moderate"), v.literal("high"))
- lactoseFlag: v.boolean()
- caffeineMgDefault: v.optional(v.number())
- carbonationFlag: v.boolean()
- spiceBand: v.union(v.literal("none"), v.literal("mild"), v.literal("moderate"), v.literal("hot"))
- tags: v.array(v.string()) — e.g., "binding", "hydrating", "low_residue"
- nutritionPer100g: v.optional(v.object({ kcal: v.optional(v.number()), fatG: v.optional(v.number()), carbsG: v.optional(v.number()), fiberG: v.optional(v.number()), proteinG: v.optional(v.number()), sugarG: v.optional(v.number()), saltG: v.optional(v.number()) }))
- isStarterSeed: v.boolean() — defaults to false
- active: v.boolean()

⠀Indexes: by_canonicalName ["canonicalName"], by_defaultStageId ["defaultStageId"], by_categoryId ["categoryId"]

#### foodAliases

- foodItemId: v.id("foodItems")
- alias: v.string()
- locale: v.optional(v.string())
- source: v.string()

⠀Indexes: by_alias ["alias"], by_foodItemId ["foodItemId"]

#### brandProducts

Cached lookup table for scanned or searched packaged foods. Later phase, feature-flagged.

- foodItemId: v.optional(v.id("foodItems"))
- barcode: v.string()
- brandName: v.string()
- productName: v.string()
- servingSizeValue: v.optional(v.number())
- servingSizeUnit: v.optional(v.string())
- nutritionJson: v.optional(v.object({ kcal: v.optional(v.number()), fatG: v.optional(v.number()), carbsG: v.optional(v.number()), fiberG: v.optional(v.number()), proteinG: v.optional(v.number()), sugarG: v.optional(v.number()), saltG: v.optional(v.number()) }))
- ingredientsText: v.optional(v.string())
- postopTags: v.optional(v.array(v.string()))
- categoryGuessId: v.optional(v.id("foodCategories"))
- mappingConfidence: v.optional(v.number())
- sourceSystem: v.string()
- verified: v.boolean()
- updatedAt: v.number()

⠀Indexes: by_barcode ["barcode"], by_foodItemId ["foodItemId"]

#### userFoodItems

Covers restaurant meals, homemade dishes, and personal custom items.

- userId: v.id("users")
- linkedFoodItemId: v.optional(v.id("foodItems"))
- customName: v.string()
- brandName: v.optional(v.string())
- categoryId: v.optional(v.id("foodCategories"))
- defaultPortionValue: v.optional(v.number())
- defaultPortionUnit: v.optional(v.string())
- notes: v.optional(v.string())
- createdAt: v.number()

⠀Indexes: by_userId ["userId"]

##### Design notes

- `food_items` is the canonical catalog.
- `brand_products` acts as a cached lookup table for scanned or searched packaged foods.
- `user_food_items` covers restaurant meals, homemade dishes, and personal custom items.
- Suggestions should rely on postoperative tags and category guidance, not just calories/macros.

### 2.5 Food Categories and Reintroduction Timing Guidance

#### Default stage model for content authoring

- Stage 0: Clear & Hydrate (`0+ days`, often clinician-led)
- Stage 1: Gentle Soft Foods (`~days 3–14`)
- Stage 2: Low-Residue Expansion (`~weeks 2–6`)
- Stage 3: Guided Reintroduction (`~weeks 6–12`)
- Stage 4: Personalized Long-Term (`12+ weeks`)

- These are sensible defaults derived from published NHS, MSKCC, and dietetic association guidelines.
- They must be overrideable per surgery type and per user's aftercare team instructions.
- The Bayesian tolerance engine calibrates to the user's personal rhythm as data accumulates.

| Category                    | Default Stage | Default Timing | Guidance Summary                              |
| --------------------------- | ------------: | -------------- | --------------------------------------------- |
| Hydration & Clear Liquids   |           0/1 | 0+ days        | prioritize hydration, small sips, low residue |
| Gentle Starches             |             1 | ~days 3+       | bland, soft, low-fiber bases                  |
| Soft Proteins               |           1/2 | ~days 3–7+     | soft texture, low fat, simple prep            |
| Dairy & Alternatives        |           1/2 | ~days 5–10+    | trial carefully if lactose-sensitive          |
| Soft Fruits                 |             2 | ~days 10–14+   | peeled, canned, pureed, ripe                  |
| Cooked Vegetables           |             2 | ~week 2+       | cooked soft, peeled if relevant               |
| Simple Mixed Meals          |             2 | ~week 2+       | easy-to-digest combinations                   |
| Fats / Spreads / Condiments |           2/3 | ~weeks 2–6     | small quantities first                        |
| Moderate Challenge Foods    |             3 | ~weeks 6–12    | one at a time, observe windows                |
| Higher Challenge Foods      |             4 | ~12+ weeks     | individualized, cautious reintroduction       |

#### Surgery-Specific Override Guidance

`category_guidance` should support overrides such as:

- ileostomy reversal / J-pouch: delay caffeine, carbonation, spicy foods, and very sugary items
- low anterior resection: extra caution with urgency-triggering foods, raw fiber, and large meals
- small bowel resection: stronger hydration emphasis and caution with sugar alcohols
- clinician override always takes precedence

### 2.6 Seed Food Catalog: 100 Starter Foods Pre-Categorized

All items below should be inserted into `food_items` with `is_starter_seed = true`.

1. Hydration & Clear Liquids — Stage 0/1
   1. Water
   2. Oral rehydration solution
   3. Diluted apple juice
   4. Clear chicken broth
   5. Clear vegetable broth
   6. Coconut water
   7. Peppermint tea
   8. Chamomile tea
   9. Gelatin dessert
   10. Electrolyte ice pop

2. Gentle Starches — Stage 1 11. White toast 12. Saltine crackers 13. Plain white rice 14. Cream of rice cereal 15. Plain pasta 16. Rice noodles 17. Mashed potatoes without skin 18. Plain bagel 19. English muffin 20. Plain pancakes

3. Soft Proteins — Stage 1/2 21. Scrambled eggs 22. Poached eggs 23. Egg white omelet 24. Baked cod 25. Baked tilapia 26. Shredded chicken breast 27. Lean ground turkey 28. Tender turkey meatballs 29. Soft tofu 30. Lean deli turkey

4. Dairy & Alternatives — Stage 1/2 31. Plain yogurt 32. Greek yogurt 33. Lactose-free yogurt 34. Cottage cheese 35. Kefir 36. Lactose-free milk 37. Soy milk 38. Oat milk 39. Vanilla pudding 40. Mild cheddar cheese

5. Soft Fruits — Stage 2 41. Banana 42. Applesauce 43. Stewed peeled apple 44. Canned peaches 45. Canned pears 46. Ripe cantaloupe 47. Ripe honeydew 48. Papaya 49. Mango puree 50. Avocado

6. Cooked Vegetables — Stage 2 51. Cooked carrots 52. Butternut squash puree 53. Pumpkin puree 54. Peeled zucchini, cooked 55. Peeled yellow squash, cooked 56. Green beans, cooked soft 57. Spinach, cooked and chopped 58. Cooked beets 59. Cooked parsnips 60. Cooked turnips

7. Simple Mixed Meals — Stage 2 61. Chicken noodle soup 62. Rice congee 63. Cream of wheat 64. Polenta 65. Oatmeal 66. Mild macaroni and cheese 67. Turkey rice soup 68. Mashed potato bowl with chicken 69. Tuna salad sandwich on white bread 70. Plain ramen with soft egg

8. Fats, Spreads, and Simple Condiments — Stage 2/3 71. Butter 72. Olive oil 73. Mayonnaise 74. Smooth peanut butter 75. Smooth almond butter 76. Jam without seeds 77. Maple syrup 78. Mild gravy 79. Soy sauce 80. Smooth hummus

9. Moderate Challenge Foods — Stage 3 81. Whole wheat toast 82. Brown rice 83. Quinoa 84. Blueberries 85. Strawberries 86. Cooked broccoli 87. Cooked cauliflower 88. Pureed lentil soup 89. Decaf coffee 90. Mild curry chicken

10. Higher Challenge Foods — Stage 4 91. Salad greens 92. Raw apple with skin 93. Popcorn 94. Almonds 95. Corn kernels 96. Black beans 97. Carbonated soda 98. Regular coffee 99. Spicy salsa 100. Fried chicken

### 2.7 Tracking & Logging Tables

#### Capture and Meals

- captureEvents: `userID`: `v.id("users")`, `captureType`: `v.union(v.literal("text"), v.literal("voice"), v.literal("form"), v.literal("barcode"))`, `rawText`: `v.optional(v.string())`, `transcript`: `v.optional(v.string())` voice-to-text result, `parserStatus`: `v.union(v.literal("pending"), v.literal("parsed"), v.literal("failed"), v.literal("skipped"))`, `parseConfidence`: `v.optional(v.number())`, `parsedPayload`: `v.optional(v.object())` structured output from parser, `createdAt`: `v.number()`

Indexes: `by_userId` [`userId`], `by_parserStatus_createdAt` [`parserStatus`, `createdAt`]

- mealLogs: `userId`: `v.id("users")`, `occurredAt`: `v.number()`, `mealType`: `v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("dinner"), v.literal("snack"), v.literal("drink"))`, `captureMethod`: `v.union(v.literal("manual"), v.literal("text_nlp"), v.literal("voice_nlp"), v.literal("barcode"), v.literal("form"))`, `notes`: `v.optional(v.string())`, `createdAt`: `v.number()`

⠀Indexes: `by_userId` [`userId`], `by_userId_occurredAt` [`userId`, `occurredAt`]

- mealLogItems: `mealLogId`: `v.id("mealLogs")`, `foodItemId`: `v.optional(v.id("foodItems"))`, `userFoodItemId`: `v.optional(v.id("userFoodItems"))`, `brandProductId`: `v.optional(v.id("brandProducts"))`, `quantityValue`: `v.optional(v.number())`, `quantityUnit`: `v.optional(v.string())`, `portionEstimateConfidence`: `v.optional(v.number())`, `preparationMethod`: `v.optional(v.string())`, `isNewFood`: `v.boolean()` — defaults to false, `nutritionSnapshot`: `v.optional(v.any())` — point-in-time nutrition data, `riskTagSnapshot`: `v.optional(v.array(v.string()))` — point-in-time risk tags, `experimentId`: `v.optional(v.id("foodExperiments"))`, `stimulantMgExtracted`: `v.optional(v.number())`, `sequenceNo`: `v.number()`

Constraint: exactly one of `foodItemId`, `userFoodItemId`, or `brandProductId` must be populated per item.

Indexes: `by_mealLogId` [`mealLogId`]

#### Output and Symptoms

- outputLogs: `userId`: `v.id("users")`, `occurredAt`: `v.number()`, `bristolType`: `v.number()` — 1–7, `amount`: `v.optional(v.union(v.literal("small"), v.literal("moderate"), v.literal("large")))`, `urgency`: `v.optional(v.union(v.literal("none"), v.literal("mild"), v.literal("moderate"), v.literal("urgent"), v.literal("accident")))`, `sensation`: `v.optional(v.string())` — free-text descriptor, e.g., "burning", "crunchy", `strain`: `v.optional(v.boolean())`, `incompleteEmptying`: `v.optional(v.boolean())`, `episodesCount`: `v.optional(v.number())` — consecutive BMs in one session, defaults to 1, `notes`: `v.optional(v.string())` — generous text allowance for the user to describe the experience, `createdAt`: `v.number()`

⠀Indexes: `by_userId` [`userId`], `by_userId_occurredAt` [`userId`, `occurredAt`]

- symptomLogs: `userId`: `v.id("users")`, `occurredAt`: `v.number()`, `symptomType`: `v.union(v.literal("nausea"), v.literal("bloating"), v.literal("cramping"), v.literal("gas"), v.literal("fatigue"), v.literal("headache"), v.literal("other"))`, `severity`: `v.number()` — 0–10, `durationMinutes`: `v.optional(v.number())`, `relatedMealLogId`: `v.optional(v.id("mealLogs"))`, `relatedOutputLogId`: `v.optional(v.id("outputLogs"))`, `notes`: `v.optional(v.string())`

⠀Indexes: `by_userId` [`userId`], `by_userId_occurredAt` [`userId`, `occurredAt`]

#### Sleep, Activity, Stress, Stimulants

- sleepLogs: `userID`: `v.id("users")`, `sleep_start`: `v.number()`, `sleep_end`: `v.number()`, `duration_minutes`: `v.number()`, `quality_score`: `v.number()` — 1–5, `interruptions`: `v.number()` — NULLable, `source`: `v.union(v.literal("manual"), v.literal("health_connect"), v.literal("healthkit"))`

⠀Indexes: `by_userId` [`userId`], `by_userId_sleepStart` [`userId`, `sleepStart`]

- activityLogs: `userID`: `v.id("users")`, `start_at`: `v.number()`, `end_at`: `v.number()`, `duration_minutes`: `v.number()`, `activity_type`: `v.string()` — e.g., "walking", "yoga", "cycling", `intensity`: `v.union(v.literal("light"), v.literal("moderate"), v.literal("vigorous"))`, `steps`: `v.optional(v.number())`, `source`: `v.union(v.literal("manual"), v.literal("health_connect"), v.literal("healthkit"))`

⠀Indexes: `by_userId` [`userId`], `by_userId_startAt` [`userId`, `startAt`]

- stressLogs: `userID`: `v.id("users")`, `occurred_at`: `v.number()`, `stress_score`: `v.number()` — 1–5, `primary_stressor`: `v.optional(v.string())`, `stressor_tags`: `v.optional(v.array(v.string()))`, `notes_encrypted`: `v.optional(v.string())`

⠀Indexes: `by_userId` [`userId`], `by_userId_occurredAt` [`userId`, `occurredAt`]

- stimulantLogs: `userID`: `v.id("users")`, `occurred_at`: `v.number()`, `stimulant_type`: `v.union(v.literal("caffeine"), v.literal("nicotine"), v.literal("alcohol"), v.literal("other"))`, `source`: `v.optional(v.string())` — e.g., "coffee", "tea", "cigarette", "energy drink", `amount_value`: `v.optional(v.number())`, `amount_unit`: `v.optional(v.string())`, `estimated_mg`: `v.optional(v.number())`, `linked_meal_log_item_id`: `v.optional(v.id("mealLogItems"))`, `notes`: `v.optional(v.string())`

⠀Indexes: `by_userId` [`userId`], `by_userId_occurredAt` [`userId`, `occurredAt`]

#### Medications

- medicationCatalog: `genericName`, `v.string()`, `brandName`, `v.optional(v.string())`, `medClass`, `v.optional(v.string())`, `transitEffect`, `v.union(v.literal("loosening"), v.literal("constipating"), v.literal("neutral"), v.literal("variable"))`, `notes`, `v.optional(v.string())`

⠀Indexes: `by_genericName` [`genericName`]

- userMedications: `userId`, `v.id("users")`, `medicationCatalogId`, `v.optional(v.id("medicationCatalog"))`, `customName`, `v.optional(v.string())`, `doseValue`, `v.optional(v.number())`, `doseUnit`, `v.optional(v.string())`, `prescribed`, `v.boolean()`, `active`, `v.boolean()`, `startedOn`, `v.optional(v.string())` — YYYY-MM-DD, `endedOn`, `v.optional(v.string())` — YYYY-MM-DD

⠀Indexes: `by_userId` [`userId`]

- medicationLogs: `userMedicationId`, `v.id("userMedications")`, `takenAt`, `v.number()`, `doseTaken`, `v.optional(v.number())`, `route`, `v.optional(v.union(v.literal("oral"), v.literal("topical"), v.literal("injection"), v.literal("suppository"), v.literal("other")))` , `notes`, `v.optional(v.string())`

⠀Indexes: `by_userMedicationId` [`userMedicationId`], `by_takenAt` [`takenAt`]

### Media

- mediaAssets: `userId`, `v.id("users")`, `media_type`, `v.union(v.literal("image"), v.literal("video"))`, `storage_key`, `v.string()`, `thumbnail_key`, `v.optional(v.string())`, `mime_type`, `v.string()`, `byte_size`, `v.number()`, `width`, `v.optional(v.number())`, `height`, `v.optional(v.number())`, `duration_seconds`, `v.optional(v.number())`, `sha256`, `v.string()`, `consent_scope`, `v.union(v.literal("limited"), v.literal("full"))`, `retention_policy`, `v.union(v.literal("short"), v.literal("medium"), v.literal("long"))`, `created_at`, `v.number()`, `deleted_at`, `v.optional(v.number())`

⠀Indexes: `by_userId` [`userId`], `by_userId_createdAt` [`userId`, `createdAt`]

### 2.8 Food Experimentation, Insights, and AI Tables

#### Food Experiments

- foodExperiments: `userId: v.id("users")`, `targetFoodItemId: v.optional(v.id("foodItems"))`, `targetUserFoodItemId: v.optional(v.id("userFoodItems"))`, `startedAt: v.number()`, `hypothesisText: v.optional(v.string())`, `initialServingText: v.optional(v.string())`, `plannedObservationHours: v.number()`, `status: v.union(v.literal("active"), v.literal("observing"), v.literal("completed"), v.literal("cancelled"))`, `createdBy: v.union(v.literal("user"), v.literal("ai_suggested"))`

⠀Indexes: `by_userId` [`userId`], `by_userId_status` [`userId`, `status`]

- experimentExposures: `experimentId: v.id("foodExperiments")`, `mealLogItemId: v.id("mealLogItems")`, `exposureOrder: v.number()`

⠀Indexes: `by_experimentId` [`experimentId`]

- experimentOutcomes: `experimentId: v.id("foodExperiments")`, `windowStart: v.number()`, `windowEnd: v.number()`, `outputSummary: v.optional(v.string())` — serialized JSON; parsed and validated on read, `symptomSummary: v.optional(v.string())` — serialized JSON; parsed and validated on read, `inferredEffect: v.union(v.literal("tolerated"), v.literal("unclear"), v.literal("suspected_trigger"), v.literal("confirmed_trigger"))`, `confidence: v.number()`, `userRating: v.optional(v.union(v.literal("felt_fine"), v.literal("not_sure"), v.literal("felt_bad")))`

⠀Indexes: `by_experimentId` [`experimentId`]

#### Derived Insight Tables

- dailyTransitInsights: `userId: v.id("users")`, `date: v.string() — YYYY-MM-DD`, `healingStageId: v.number()`, `baselineMinHours: v.number()`, `baselineMaxHours: v.number()`, `estimatedMinHours: v.number()`, `estimatedMaxHours: v.number()`, `looseTendencyScore: v.number() — 0–100`, `hardTendencyScore: v.number() — 0–100`, `confidence: v.number()`, `factors: v.optional(v.array(v.object({ factor: v.string(), direction: v.union(v.literal("faster"), v.literal("slower"), v.literal("uncertain")), weight: v.number() })))`, `generatedAt: v.number()`
- foodToleranceScores: `userId: v.id("users")`, `foodItemId: v.optional(v.id("foodItems"))`, `userFoodItemId: v.optional(v.id("userFoodItems"))`, `posteriorMean: v.number()` Bayesian posterior mean, `confidence: v.number()`, `evidenceCount: v.number()`, `dominantPattern: v.union(v.literal("tolerated"), v.literal("unclear"), v.literal("suspected_trigger"), v.literal("confirmed_trigger"))`, `lastUpdated: v.number()`

⠀Indexes: `by_userId` [`userId`], `by_userId_foodItemId` [`userId`, `foodItemId`]

#### Recommendation Rule Versioning

- ruleSets: `ruleType: v.union(v.literal("stage_progression"), v.literal("food_scoring"), v.literal("safety_escalation"), v.literal("transit_estimation"))`, `version: v.string()`, `contentJson: v.string()` — versioned rule definition stored as serialized JSON; parsed and validated by the rule engine at runtime, `approvedBy: v.string()`, `approvedAt: v.number()`, `active: v.boolean()`

⠀Indexes: by_ruleType ["ruleType"], by_ruleType_active ["ruleType", "active"]`

#### AI Conversation and Memory

- aiThreads: `userId: v.id("users")`, `title: v.optional(v.string())`, `style: v.union(v.literal("warm_coach"), v.literal("calm_clinical"), v.literal("straight_to_the_point"), v.literal("reflective_guide"))`, `createdAt: v.number()`, `archivedAt: v.optional(v.number())`

⠀Indexes: `by_userId` [`userId`]

- aiMessages: `threadId: v.id("aiThreads")`, `role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system"))`, `contentEncrypted: v.string()`, `citations: v.optional(v.array(v.object({ title: v.string(), url: v.optional(v.string()), accessedAt: v.optional(v.number()) })))`, `metadata: v.optional(v.object({tokensUsed: v.optional(v.number()), modelId: v.optional(v.string()), latencyMs: v.optional(v.number())}))`, `createdAt: v.number()`, `safetyLabel: v.optional(v.union(v.literal("safe"), v.literal("escalated"), v.literal("flagged")))`

⠀Indexes: `by_threadId` [`threadId`], `by_threadId_createdAt` [`threadId`, `createdAt`]

- aiMemoryFiles: Versioned per-user memory snapshots used to give the AI coach persistent context across sessions. `userId`: `v.id("users")`, `fileName`: `v.string() — e.g., "profile", "preferences", "tolerance_map", "pattern_summary", "open_questions", "conversation_summary"`, `memoryType`: `v.union(v.literal("profile"), v.literal("preferences"), v.literal("tolerance_map"), v.literal("pattern_summary"), v.literal("open_questions"), v.literal("conversation_summary"))`, `version`: `v.number()`, `checksum`: `v.string()`, `contentJson`: `v.string()` — memory snapshot stored as serialized JSON; each memoryType has its own expected shape validated at read time, `storedAt: v.number()`, `active: v.boolean()`

⠀Indexes: `by_userId` [`userId`], `by_userId_memoryType` [`userId`, `memoryType`]

- generatedArtifacts: `userId: v.id("users")`, `sourceThreadId: v.optional(v.id("aiThreads"))`, `artifactType: v.union(v.literal("meal_plan"), v.literal("shopping_list"), v.literal("experiment_card"), v.literal("weekly_summary"), v.literal("aftercare_report"), v.literal("appointment_questions"))`, `title: v.string()`, `configJson: v.optional(v.string()) — serialized JSON; parameters used to generate`, `contentJson: v.string() — serialized JSON; the artifact content`, `createdAt: v.number()`

⠀Indexes: `by_userId` [`userId`], `by_userId_artifactType` [`userId`, `artifactType`]

### 2.9 Notification, Engagement, and Supportive Mechanics Tables

- notificationPreferences: `userId: v.id("users")`, `morningSummaryTime: v.optional(v.string()) — e.g., "08:00"`, `experimentCheckinsEnabled: v.boolean()`, `outputRemindersEnabled: v.boolean()`, `coachFollowupsEnabled: v.boolean()`, `quietHours: v.optional(v.object({ start: v.string(), end: v.string() }))`

⠀Indexes: `by_userId` [`userId`]

- reminderRules: `userId: v.id("users")`, `triggerType: v.union(v.literal("time_based"), v.literal("post_meal"), v.literal("experiment_window"), v.literal("missed_checkin"))`, `schedule: v.object({ intervalHours: v.optional(v.number()), timeOfDay: v.optional(v.string()), daysOfWeek: v.optional(v.array(v.string())) })`, `active: v.boolean()`

⠀Indexes: by_userId ["userId"]

- engagementStreaks: `userId: v.id("users")`, `checkInDaysCurrent: v.number()`, `checkInDaysBest: v.number()`, `lastCheckInDate: v.optional(v.string()) — YYYY-MM-DD`, `graceTokens: v.number() — defaults to 0; prevents "all or nothing" streak loss`

⠀Indexes: by_userId ["userId"]

- badgeDefinitions: `code: v.string() — unique`, `title: v.string()`, `description: v.string()`, `styleToken: v.string()`

⠀Indexes: by_code ["code"]

- userBadges: `userId: v.id("users")`, `badgeId: v.id("badgeDefinitions")`, `awardedAt: v.number()`

⠀Indexes: by_userId ["userId"]

### 2.10 Key Relationships

- `users 1:1 userProfiles`
- `users 1:1 userPreferences`
- `users 1:many surgeryEvents`
- `surgeryTypes 1:many surgeryEvents`
- `reintroductionStages 1:many foodCategories (via defaultStageId)`
- `foodCategories 1:many foodItems`
- `foodCategories many:many surgeryTypes through categoryGuidance`
- `users 1:many mealLogs, outputLogs, sleepLogs, activityLogs, stressLogs, stimulantLogs, symptomLogs`
- `mealLogs 1:many mealLogItems`
- `mealLogItems many:1 foodItems or userFoodItems or brandProducts`
- `foodExperiments 1:many experimentExposures and experimentOutcomes`
- `users 1:many dailyTransitInsights, foodToleranceScores`
- `users 1:many aiThreads, aiMemoryFiles, generatedArtifacts`
- `aiThreads 1:many aiMessages`

### 2.11 Recommended Indexes and Constraints

- Unique: `dailyTransitInsights` by (`userId`, `date`)
- Unique: `foodToleranceScores` by (`userId`, `foodItemId`) and (`userId`, `userFoodItemId`) — enforced in mutation logic
- Full text search index on `foodItems.canonicalName` and `foodAliases.alias`
- Unique: `brandProducts.barcode`
- Index: `captureEvents` by (`parserStatus`, `createdAt`)
- Index on all log tables: (`userId`, `occurredAt`) descending by convention
- Vector index on food embedding table for semantic retrieval (dimensions matching embedding model, e.g., 1536 for OpenAI)

⠀Note: Convex does not support multi-field unique constraints at the schema level. Uniqueness on composite keys must be enforced in mutation logic before insert. Convex vector indexes are defined with vectorIndex() in the schema and support filter fields for scoped similarity search.

---

## PHASE 3: DATA CAPTURE & LOGGING SYSTEM

### 3.1 Capture Modes

| Mode          | Best For                             | Flow                                                     | Confirmation Rule                         |
| ------------- | ------------------------------------ | -------------------------------------------------------- | ----------------------------------------- |
| Text NLP      | fast food or output logging          | user types sentence, parser extracts entities            | required if confidence < 0.85             |
| Voice capture | low-friction logging during recovery | push-to-talk, speech-to-text, parse                      | transcript editable before save           |
| Food image    | mixed meals, packaged foods          | image upload + vision suggestions + optional OCR/barcode | always user-confirmed                     |
| Output image  | optional Bristol assistance          | image capture + classifier suggestion                    | always user-confirmed                     |
| Form/manual   | highest certainty                    | tap-based fields and steppers                            | direct save                               |
| Barcode scan  | branded items                        | scan UPC/EAN, lookup product, map tags                   | confirm serving and category if uncertain |

### 3.2 Natural Language Processing for Food/Drink Logging

#### Functional Requirements

- The parser should extract:
  - food items
  - beverages
  - quantity and units
  - preparation method
  - meal time
  - meal type
  - brand/product clues
  - caffeine/stimulant hints
  - free-text notes

- Example intents:
  - “Had half a bagel with peanut butter and decaf coffee at 8”
  - “Scrambled eggs and white toast for breakfast”
  - “Bristol 6, urgent, small amount”

#### Technical Approach

- Use a hybrid pipeline:
  1. Intent classifier: food log vs output log vs symptom note vs coach question
  2. Named entity extraction for foods, amounts, brands, times
  3. Canonical mapping against `food_items`, `brand_products`, `user_food_items`
  4. Confidence scoring
  5. Structured draft creation
  6. One-step confirmation UI if needed

#### Parsing Rules

- If confidence ≥ 0.85: prefill and allow one-tap save
- If 0.60–0.84: ask one clarifying question or present top 3 matches
- If < 0.60: route to editable manual form
- Store raw text in `capture_events` for audit and re-processing if user permits

### 3.3 Voice Capture Integration

- Push-to-talk button in FAB sheet and output screen
- Streaming transcription where possible
- On-device transcription preferred when privacy-capable and available
- Cloud fallback only with compliant vendor agreements
- Show live transcript preview
- Allow “save as note” or “convert to log”
- Auto-delete raw audio after transcription by default unless user opts to retain

### 3.4 Image Recognition

#### Food Image Recognition

- Capabilities:
  - multi-label food suggestion for simple meals
  - OCR for package labels
  - barcode detection when visible
  - portion estimate as low-confidence hint only

- Limitations:
  - mixed dishes should return multiple candidates with low confidence
  - user confirmation is mandatory
  - photo analysis should enhance speed, not auto-log silently

#### Output Image Recognition

Capabilities:

- classify likely Bristol range
- detect image quality/insufficient view
- suggest, never finalize

Requirements:

- opt-in only
- private consent prompt before first use
- strong deletion controls
- on-device pre-processing where feasible
- server-side analysis only with compliant infrastructure
- default user-facing language: “suggested Bristol type,” not diagnosis

Regulatory note:

- treat as assistive classification, not diagnostic medical interpretation
- consider feature flag until clinical and legal review is complete

### 3.5 Form-Based Input Options

#### Food/Drink Form

- Required:
  - at least one item
  - time

- Optional:
  - amount
  - unit
  - preparation
  - “new food” toggle
  - photo
  - notes

#### Output Form

- Required:
  - Bristol type or photo-assisted suggestion confirmed by user
  - time

- Optional:
  - urgency
  - amount
  - pain
  - blood/mucus
  - note
  - image

#### Other Tracking Forms

- Sleep: hours or start/end
- Activity: duration and intensity
- Stress: 1–5 score + optional tag
- Medication: medication + time
- Stimulant: source + estimated amount or serving

### 3.6 Multi-Modal Input Validation and Processing

#### Unified Processing Pipeline

1. Capture raw input into `capture_events`
2. Attach media if present
3. Run parser/classifier jobs asynchronously
4. Build structured draft
5. Present user confirmation
6. Save final log
7. Trigger background jobs:
   - update transit insight
   - update tolerance score
   - refresh Today recommendations
   - update AI memory summary

#### Validation Rules

- no future timestamps beyond small tolerance
- quantity/unit normalization to internal standard
- duplicate detection by:
  - same user
  - same time window
  - similar parsed content
- Bristol values restricted to 1–7
- high-risk terms or red flags trigger safety triage
- if two capture modes conflict, ask user to choose final structured interpretation

#### Provenance Tracking

- Every saved entry should include source provenance:
  - manual
  - text NLP
  - voice NLP
  - image-assisted
  - barcode-assisted
  - AI-suggested then user-confirmed

### 3.7 Required vs Optional Tracking Fields

| Data Type  | Required                   | Optional                                                             |
| ---------- | -------------------------- | -------------------------------------------------------------------- |
| Onboarding | surgery type, surgery date | sex at birth, dietary preferences, allergies, clinician restrictions |
| Food log   | food item, timestamp       | amount, unit, prep, new-food flag, image, note                       |
| Output log | Bristol type, timestamp    | urgency, amount, pain, image, note, blood/mucus                      |
| Sleep      | duration or start/end      | quality, interruptions, source                                       |
| Activity   | duration or steps          | type, intensity, source                                              |
| Stress     | score                      | tag, note                                                            |
| Medication | medication, timestamp      | dose, route, note                                                    |
| Stimulant  | source/type, timestamp     | amount, mg estimate, note                                            |

### 3.8 Gamification: Supportive, Not Judgmental

#### Design Rules

- No leaderboards
- No punishment for missed days
- No moral color coding
- Badges celebrate curiosity and self-observation, not perfection

#### Suggested Mechanics

- “Check-in rhythm” for any daily interaction
- “Pattern Spotter” for reviewing trend insights
- “First Experiment” for testing a new food
- “Back Again” for returning after a gap
- “Question Asker” for using coach support

#### Streak Policy

- Grace tokens prevent “all or nothing” loss
- Missing days never produce red failure UI
- Messaging example: “You can pick up again with your next check-in.”

### 3.9 Connectivity and Entry Recovery

- The app requires an internet connection to function. All data is persisted server-side via Convex.
- If the network becomes unavailable, the app should display a clear, non-alarming message explaining that connectivity is required.
- The last unsubmitted entry (whether a log, a note, or any other input) should be held in client memory. No further use of the app is possible until connectivity is restored.
- On reconnection, the user can pick up where they left off — their most recent unsubmitted entry is available to send and save.
- There is no background sync, no local database, no reconciliation logic, and no append-only offline queue.

---

## PHASE 4: AI COACH & CHAT ASSISTANT

### 4.1 AI Coach Role

#### Core Role Definition

- The AI assistant is a **multi-personality system** designed specifically for the PDH app.
- It functions as a **lifestyle companion** that supports the user from post-surgery recovery through to long-term dietary stability and optimization.
- The system’s purpose is to:
  - guide the user from restricted post-surgery eating → safe reintroduction → broader dietary flexibility → long-term gut stability
  - educate the user on how their **individual modifiers** (food, lifestyle, stimulants, stress, sleep) affect bowel output
  - help the user maintain **autonomy and control** over their digestion, even when making imperfect or non-ideal choices
  - remain useful even with **incomplete or inconsistent logging**
  - encourage continued engagement through **ADHD-friendly interaction patterns and light gamification**

#### Personality-Based Interaction Model

- The assistant operates through **four distinct personalities**, each acting as a specialized consultant with its own tone, emphasis, and conversational behavior.
- Each personality maintains its own **persistent conversation thread**, while sharing a common underlying data layer.
- This creates the experience of interacting with a **team of aligned consultants**, rather than a single generic assistant.

#### Personality Threading Model

- Each personality operates within its own **persistent conversation thread**
- Switching personality:
  - pauses the current thread
  - resumes the selected personality thread

### 4.2 AI System Architecture

#### Recommended layered design

1. Safety layer
2. Context retrieval layer
3. Deterministic recommendation engine
4. Personality Routing Layer
5. LLM response generator
6. Memory updater
7. Artifact construction layer

##### 1. **Safety layer**

- evaluates all inputs and outputs for safety risks before processing
- enforces escalation rules for:
  - medical red flags
  - unsafe advice scenarios
- can override downstream layers by:
  - blocking response generation
  - triggering escalation messaging

##### 2. **Context Retrieval Layer**

- All context retrieval must be scoped to the active personality thread by default
- Shared memory may be accessed across threads, but:
  - conversational context must not leak between personality threads
  - Thread isolation must be enforced at the retrieval layer, not only at memory storage

##### 3. **Deterministic recommendation engine**

- generates:
  - food recommendations
  - risk flags
  - stage-based constraints
  - scoring outputs
  - operates using:
    - rule-based logic
    - research-backed constraints
    - user-specific data models
    - outputs structured data for LLM explanation and artifact construction
- **Deterministic vs Generative Responsibility Boundary**
  - The deterministic system defines:
    - food safety rules
    - stage restrictions
    - red-flag conditions
    - recommendation scoring
  - The LLM (AI assistant) is responsible for:
    - explaining decisions
    - personalizing communication
    - adapting tone to the selected personality
    - guiding user understanding
  - The assistant must **never override deterministic safety rules**.

##### 4. **Personality routing layer**

- determines the active personality based on:
  - user selection
  - current thread
- applies:
  - personality-specific system prompt
    - tone constraints
    - response style rules
  - ensures:
    - responses are consistent with the selected personality
    - thread-specific conversational continuity is maintained

##### 5. **LLM response generator**

- converts structured outputs into natural language responses
- adapts:
  - tone
  - structure
  - explanation depth
    personality style
  - must not:
    - introduce new rules
    - override deterministic outputs
    - generate medical advice outside defined constraints

##### 6. **Memory updater**

- updates:
  - user preference memory
  - tolerance scores
  - conversation summaries
- operates under:
  - validation rules
  - confidence thresholds
- ensures:
  - uncertain conclusions are stored as tentative
  - memory updates are traceable and versioned

##### 7. **Artifact construction layer**

- Generates UI artifacts based on deterministic outputs
- Ensures artifacts are consistent with the active personality
- Handles formatting and presentation logic
- Converts deterministic outputs and structured data into:
  - reusable artifacts
    - formatted summaries
  - ensures:
    - consistency of structure
    - separation from conversational text
  - outputs are:
    - renderable in UI
    - storable and retrievable

#### Critical rule

- the LLM should explain and personalize recommendations
- the underlying food suggestions, red-flag rules, and stage restrictions should come from deterministic recommendation engine and research-backed rule sets — not freeform LLM generation alone.

### 4.3 Proactive vs Reactive Engagement

#### Conversational Proactivity (In-Session)

- occurs when the user opens or engages with chat
- includes:
  - greetings
  - referencing recent activity
  - suggesting next steps
- does not require user opt-in
- must feel:
  - natural
  - contextual
  - non-intrusive

#### Notification Proactivity (Out-of-Session)

- occurs outside the chat interface
- includes:
  - reminders
  - nudges
  - summaries
- requires user configuration and consent
- follows notification discipline rules

#### Reactive Patterns

- User-initiated:
  - “What can I eat for lunch?”
  - “Did bananas help me?”
  - “Summarize my last week”
  - “What should I test next?”

#### Proactive Patterns

- Only if enabled by user:
  - morning summary with 3 gentle options
  - follow-up after logging a new food
  - reminder if output check-in is due during an experiment
  - weekly summary artifact
  - gentle prompt when insights are low-confidence and one high-value data point could help

#### Proactive Conversational Role

- The assistant is **proactive, not purely reactive**.
- It may:
  - greet the user based on time of day
  - reference recent logs or activity
  - acknowledge returning users after inactivity
  - suggest next steps based on current data
- Proactive behavior must feel:
  - natural
  - non-intrusive
  - conversational rather than notification-driven
  - must not repeat previously acknowledged context unless new information is available

#### Notification Discipline

- proactive prompts capped and configurable
- no more than 1–2 routine nudges/day by default
- urgent banners only when safety rules trigger
- user can choose:
  - low
  - medium
  - high
  - reactive only

### 4.4 Persistent Conversation Design with File-Based Memory

#### Memory Model

Use versioned per-user memory files, stored as JSON snapshots and referenced in `ai_memory_files`.

Recommended logical files:

- `profile.json`
- `preferences.json`
- `tolerance_map.json`
- `pattern_summary.json`
- `open_questions.json`
- `conversation_summary.json`

#### Example Content by File

- `profile.json`: surgery type, surgery date, allergies, diet preferences, preferred explanation style
- `tolerance_map.json`: foods tolerated, unclear, suspected triggers, confidence scores
- `pattern_summary.json`: recent tendency patterns, likely confounders, current active experiment
- `open_questions.json`: unresolved food tests, missing data points worth asking about
- `conversation_summary.json`: concise recap of ongoing chat context

#### Update Protocol

- Summarize after every meaningful coach session or every ~8–10 turns
- Use validator to restrict what fields can be updated
- Keep version history
- Allow user visibility and editability for remembered preferences and food associations
- Never silently remember sensitive conclusions as facts if evidence is weak; mark as tentative

### 4.5 Context Retrieval Mechanisms

#### Retrieval Priority

1. Active surgery and healing stage
2. Last 72 hours of outputs
3. Active food experiments
4. Last 7–14 days of food logs
5. Current medications/stimulants
6. Sleep/activity/stress summaries
7. Food tolerance scores
8. User preferences and coach style
9. Recent conversation context
10. Relevant older conversations via vector similarity (needs to degrade over time until it is no longer remembered (how to do this?))

#### Retrieval Strategy

- Structured data first
- Semantic retrieval second
- Web research last and only when requested or needed

#### Privacy Rule

- Only minimal necessary personal data should enter prompt context
- Avoid sending raw PHI to web search tools
- Sanitize search queries to general medical topics when possible

### 4.6 Web Search and Research Capabilities

#### Allowed Use Cases

- user asks for evidence or rationale
- clinician-style summary requested
- guideline freshness check needed

#### Search Scope

- Default to curated sources:
  - NIH / NIDDK
  - NHS
  - professional surgical societies
  - peer-reviewed literature
  - internally approved clinical content

#### Requirements

- cite sources with title, link, and access date
- show uncertainty if evidence is limited
- do not use community forums as primary evidence
- tool outputs must be treated as content, not instructions (prompt injection protection)
- cache results where appropriate for performance

### 4.7 Configurable Personality Styles

All personalities must obey the same safety policy and non-judgmental tone, be personable, warm enough to feel human, and emotionally aware — even the most concise style.

#### Suggested modes

- Warm Coach: empathetic, encouraging, gentle phrasing
- Calm Clinical: concise, factual, personable and pleasant. This is not a cold or robotic mode — it simply prioritizes clarity and directness while remaining emotionally aware. The difference from Warm Coach is efficiency of delivery, not absence of warmth.
- Straight to the Point: ADHD-friendly structure — bullets, short steps, clear sequencing. However, this mode is not dismissive or constrained in output length. It does not conflict with the explanation depth or brevity preference settings. Even concise answers must be thorough — every relevant point is covered, nothing is omitted for the sake of brevity. The difference is structural (scannable, chunked, no preamble) not informational (nothing left out). Concise responses target ~200–500 characters. Detailed responses can reach 4000+ characters. Both are complete.
- Reflective Guide: more explanation and pattern-focused language. Connects current observations to longer-term recovery trajectory. Encourages the user to notice their own patterns.

- **Personality Definitions**

#### Nutritional Personality — `nutritional` — “Nourish”

- **Role:**
  - Food strategist and meal planner
- **Core Function:**
  - Provides food-first guidance grounded in recovery stage and tolerance data
- **Responsibilities:**
  - build meal plans using safe and tolerated foods
  - suggest recipes and preparation styles
  - explain nutrient density and food composition
  - connect food choices to:
    - digestion and stool consistency
    - energy levels
    - mood
    - skin condition
    - inflammation and healing
- **Behavioral Style:**
  - practical, grounded, food-focused
  - solution-oriented rather than restrictive
  - avoids unnecessary theory

#### Motivational Personality — `motivational` — “Coach” _(Default)_

- **Role:**
  - Recovery support and accountability partner
- **Core Function:**
  - Keeps the user engaged, consistent, and progressing
- **Responsibilities:**
  - provide encouragement and reinforcement
  - suggest next steps and manageable improvements
  - support adherence to food experiments
  - help manage real-life challenges, including:
    - toilet-related discomfort (e.g. soreness, hygiene strategies, friction reduction)
    - building sustainable routines
    - navigating setbacks without loss of momentum
- **Behavioral Style:**
  - supportive, encouraging, non-judgmental
  - focused on progress over perfection
  - adaptive to user emotional state
- **Default Behavior:**
  - This is the **default personality on app entry**, as it maximizes retention and ongoing engagement

#### Clinical Personality — `clinical` — “Dr. Poo”

- **Role:**
  - Evidence-based explainer and systems analyst
- **Core Function:**
  - Provides structured, research-informed explanations and deeper reasoning
- **Responsibilities:**
  - explain trends using clinical-style reasoning
  - answer complex or nuanced questions
  - help the user understand:
    - modifier interactions
    - trade-offs (e.g. smoking, caffeine, diet decisions)
    - control vs risk decisions
- **Important Constraint:**
  - supports user autonomy without endorsing harmful behavior
  - remains factual, not moralizing
- **Behavioral Style:**
  - precise, structured, and analytical
  - references research where appropriate
  - clearly communicates uncertainty

#### Blended Personality — `casual` — “Buddy”

- **Role:**
  - Balanced, low-pressure companion combining all domains
- **Core Function:**
  - Provides guidance that blends:
    - clinical insight
    - nutritional awareness
    - motivational support
  - in a **softened, conversational, easy-to-engage tone**
- **Responsibilities:**
  - act as a generalist assistant across all domains
  - provide light guidance without overwhelming the user
  - support daily interaction and continuity
- **Behavioral Style:**
  - conversational and relaxed
  - less intense than:
    - clinical (less rigid)
    - motivational (less directive)
    - nutritional (less food-dominant)
  - integrates all three domains into a **balanced, human-feeling interaction**
- **Positioning Note:**
  - This personality may become the **most commonly used mode**, as it provides the lowest friction experience

#### User settings

- brevity preference
- emoji on/off
- proactive level
- explanation depth

Brevity and explanation depth work independently. A "concise + thorough" combination means short delivery with nothing omitted. A "detailed + brief" combination means longer prose but sticking to surface-level explanation. The personality style layers on top of both

### 4.8 Suggestion Algorithm

#### A. Transit Time Estimation

The app should output:

- transit state: very fast / fast / typical / slow / very slow
- estimated range in hours (advanced view only)
- confidence score
- loose tendency score (0–100)
- hard tendency score (0–100)

##### Inputs

- surgery type
- time since surgery
- sex at birth if provided
- recent output history
- stimulant exposure
- active medications
- activity
- sleep
- stress
- user’s personal recent baseline

##### Logic

1. Get surgery baseline range from `surgery_types`
2. Determine current healing stage from `surgery_events.surgery_date` and `reintroduction_stages`
3. Compute personal baseline from prior 14 days if enough data exists
4. Blend surgery baseline with personal baseline
5. Apply short-term modifiers from
   - medications
   - stimulants
   - output trend
   - activity
   - sleep
   - stress
6. Expand range width when uncertainty is high
7. Save result in `daily_transit_insights`

Recommended formula shape:

- `estimated_midpoint = blended_baseline × healing_modifier × short_term_modifier`
- `estimated_range = midpoint ± uncertainty_band`

##### Modifier Guidance

- Recent loose outputs and stimulant exposure shift toward faster transit
- Recent hard outputs and constipating medications shift toward slower transit
- Stress and sleep should initially affect confidence more than direction unless user-specific effects are learned
- Sex-at-birth modifier should be small, optional, and omitted if not provided

##### Presentation Rule

By default, show plain-language categories:

- “faster/looser than your usual”
- “slower/harder than your usual”
- “mixed / not enough data”

Exact hour ranges belong in advanced details only.

#### B. Loose vs Hard Tendency Tracking

##### Suggested heuristic inputs

- rolling Bristol mean
- recent urgency
- stool frequency
- straining/incomplete emptying
- stimulant exposure
- constipating vs loosening medications
- low activity
- sleep/stress patterns

##### Output

- dominant tendency
- confidence
- factors list for explainability

#### C. Food Recommendation Scoring

Each candidate food should be scored with a weighted model such as:

- 30% stage compatibility
- 25% personal tolerance history
- 15% current tendency fit
- 10% preparation/texture fit
- 10% dietary preference fit
- 10% variety/nutrition balance bonus
- penalties for:
  - known trigger history
  - clinician restriction
  - too many new foods recently
  - high-risk tags for current stage

##### Recommendation Engine Behavior

- Prefer already tolerated foods when user is unstable
- Suggest one experimental food at a time when trend is calmer
- Include portion/preparation suggestions
- Provide “Why this?” explanations
- Return candidate list with rationale and confidence for LLM phrasing

#### D. Food Tolerance Learning

##### Use per-user food tolerance scoring

- explicit feedback: user says food felt okay / not okay
- implicit evidence: outcomes in expected observation windows after exposure
- confounder-aware confidence reduction when many variables changed together

##### Bayesian Tolerance model

- Beta prior distribution per food, updated with each exposure outcome
- Recency weighting so older trials contribute less than recent ones
- Low confidence until multiple exposures exist
- Do not label a food as "trigger" from a single ambiguous event
- Multi-food attribution: when multiple foods fall in the transit window for a single output, share credit for good outcomes (minimum 60% per food) and share blame for bad outcomes more conservatively (minimum 25% per food — stronger evidence required before condemning a food)

#### E. Experiment Planning

##### When a food is marked “new”

- suggest a small initial portion
- suggest best timing based on current trend
- avoid stacking multiple new foods
- create observation windows:
  - immediate tolerance window: 0–4h
  - early bowel window: 4–24h
  - later bowel window: 24–72h or based on transit estimate
- prompt for output/symptom check-ins during observation windows

### 4.9 Report Generation, Meal Planning, and Artifact Creation

### Artifact Generation Role

- The assistant is responsible for generating structured outputs (“artifacts”), including:
  - meal plans
  - GP reports
  - weekly summaries
  - food experiment plans
  - safe food lists

- Artifacts must:
  - be generated within the chat thread
  - be clearly structured and reusable
  - reflect deterministic logic and user-specific data

### 4.10 Self-Improvement and Learning Mechanisms

#### Allowed Self-Improvement

- improve personal memory summary
- adjust user-specific tolerance confidence
- learn preferred answer length and coach style and suggest changing the user presets if there is a discrepancy
- improve parser mappings from corrections
- improve proactive reminder timing based on user behavior

#### Disallowed Autonomous Behavior

- rewriting clinical rule sets without review
- changing safety policies on its own
- global model learning from users without explicit consent and validation
- making medical claims

#### Global Learning Policy

- use opt-in, de-identified data only
- retraining or rule updates must be versioned and clinically reviewed
- A/B testing allowed for UI and wording

### 4.11 AI Capabilities and Limitations

#### Capabilities

- summarize tracked patterns
- explain patterns relative to recovery stage and personal baseline
- personalize meals and experiments
- generate reports and meal plans
- answer research-backed questions with citations
- remember preferences and prior context
- proactively follow up when useful
- ask clarifying questions when confidence is low
- remain helpful even when user data is incomplete

#### Limitations

- cannot diagnose complications
- cannot replace a surgeon or dietitian
- cannot guarantee causation from correlations
- cannot safely interpret stool photos as diagnosis
- should decline medication adjustment advice
- must hand off urgent concerns to triage guidance

#### Safety Escalation Triggers

- Detect in chat, logs, or output data:
  - blood or black stool
  - severe abdominal pain
  - persistent vomiting
  - inability to keep fluids down
  - fever
  - inability to pass gas/stool with distention
  - signs of dehydration
  - sudden major changes from baseline with concerning symptoms
  - any situation that sounds like it needs urgent medical attention

When triggered:

- immediately interrupt normal coaching behavior and decline to give any guidance on that topic without explanation.
- If the user describes symptoms that may require medical attention, direct the user to contact their surgical aftercare team or emergency services.
- If the user persists in asking for medical advice, repeat the following message: "I cannot provide medical advice. Please contact your surgical aftercare team or emergency services."
- This behavior is **mandatory and non-bypassable**.
- Continue to coach the user within the bounds of the app's capabilities.
- log event for audit

## PHASE 5: PRODUCTION READINESS

### 5.1 Platform Compatibility

#### Launch targets

- **Primary:** Google Play: Android 10+ preferred minimum
- **Secondary:** Chrome web app — functional version of the core experience, not required to match full Android feature parity at launch
- **Later:** iOS App Store (iOS 16+)
- Tablet layouts supported
- Responsive web companion optional for reports/admin, not required for MVP

#### Native capabilities required

- camera
- microphone
- push notifications
- local encrypted storage
- biometric authentication
- HealthKit / Health Connect integration (optional but recommended)

#### Web App Capabilities

- core logging, today screen, trends, coach, reports
- voice input via Web Speech API
- push notifications via service worker where supported
- responsive layout optimized for phone-sized browser viewports

### 5.2 Theme System

Theme modes:

- Light
- Dark
- System default
- High contrast variant

Implementation guidance:

- use semantic design tokens, not hardcoded hex values in components
- all component states must support both light and dark modes
- avoid pure black backgrounds; use low-glare dark neutrals

### 5.3 Color System with Purposeful Semantics

| Token               | Light     | Dark      | Purpose                             |
| ------------------- | --------- | --------- | ----------------------------------- |
| `action.primary`    | `#2563EB` | `#60A5FA` | primary CTA, links, navigation      |
| `status.gentle`     | `#0F766E` | `#2DD4BF` | likely compatible / stable guidance |
| `status.experiment` | `#D97706` | `#F59E0B` | test carefully / observe            |
| `status.urgent`     | `#DC2626` | `#F87171` | red-flag safety states              |
| `accent.coach`      | `#7C3AED` | `#A78BFA` | AI coach identity                   |
| `surface.base`      | `#F8FAFC` | `#0F172A` | app background                      |
| `surface.card`      | `#FFFFFF` | `#111827` | cards and sheets                    |
| `text.primary`      | `#0F172A` | `#F8FAFC` | main text                           |
| `text.secondary`    | `#475569` | `#CBD5E1` | supporting text                     |

Color rules:

- never use color alone to indicate meaning
- do not use green/red as moral success/failure cues
- urgency color reserved for actual safety needs

### 5.4 User Configuration Options

Users should be able to configure:

- light/dark/system theme
- reminder intensity and quiet hours
- minimal vs detailed tracking mode
- whether images/audio are retained
- whether output image analysis is enabled
- units and date format
- biometric lock
- export preferences
- data deletion and account closure
- AI Settings:
  - proactive vs reactive AI
  - coach personality
  - brevity preference (concise / standard / detailed)
  - explanation depth (brief / moderate / thorough)
  - emoji on/off
- accessibility settings:
  - reduced motion
  - high contrast
  - larger text
  - simplified home

### 5.5 Performance Optimization

#### Performance Targets

- cold start < 2.5 seconds on supported devices
- local log save < 300 ms perceived response
- Today screen data load < 1 second from local cache
- standard API responses p95 < 500 ms
- AI chat p95 < 7 seconds for non-web-search responses
- image analysis async with clear progress state
- 60 fps on core interactions

#### Optimization Tactics

- cache starter catalog locally
- precompute daily insights nightly (via Convex cron) and on write (via Convex scheduled functions)
- use Convex scheduled functions for parse and report generation jobs
- use presigned upload URLs for media
- compress images before upload
- paginate history views
- pre-aggregate trend data by day
- use Convex's reactive queries to keep the Today screen current without polling

### 5.6 Security and Privacy Considerations

#### Security Baseline

- TLS 1.2+ in transit
- AES-256 at rest (provided by Convex infrastructure)
- key management via cloud KMS (for when appstore version released)
- least-privilege access control in Convex functions (every query and mutation validates user ownership)
- secure token storage in device Keychain/Keystore
- optional biometric app lock
- audit logs for sensitive access/actions
- vendor security review for all AI/media services

#### Privacy by Design

- no ad trackers
- no sale of health data
- opt-in consent for voice and image processing
- raw audio auto-delete after transcription by default
- output images should default to minimal retention or ephemeral processing
- user can export and delete data
- minimize PHI sent to LLMs and external tools

#### AI Vendor Requirements

- no model training on customer data by default
- regional data residency controls where needed

### 5.7 Compliance Requirements

#### Health Data / Privacy

- HIPAA not relevant as we are not operating on behalf of a covered entity or handling PHI in that context
- HIPAA-grade controls recommended even for direct-to-consumer launch
- GDPR for EU users (company registered in Spain, EU rules apply)
- CCPA/CPRA for California users
- App Store / Play Store privacy disclosures required
- Clear terms of service and privacy policy presented during onboarding

#### Accessibility

- WCAG 2.2 AA
- All interactive elements must meet minimum touch target (44 x 44 pt)
- ADA-aligned accessibility practices
- Screen reader and dynamic type validation before release
- All charts must have text summary equivalents

#### Clinical / Regulatory

- perform regulatory assessment for SaMD risk
- avoid diagnostic claims
- stool image analysis should remain assistive and user-confirmed
- personalized postoperative guidance content should be 100% based on published peer reviewed clinical guidelines and versioned
- The app is a consumer wellness tool, not a medical device. Disclaimers must be present in onboarding, terms of service, and the app's store listing. The app must state clearly that it does not provide medical advice and that a registered health professional should always be consulted in case of doubt.

### 5.8 Convex Function Surface

Convex does not use REST endpoints. The API surface is defined as typed TypeScript queries, mutations, and actions. Below is the recommended function surface organized by domain.

#### Auth & Profile

- mutation: createProfile
- mutation: updateProfile
- query: getProfile
- mutation: updatePreferences
- query: getPreferences
- mutation: recordConsent

#### Surgery

- mutation: createSurgeryEvent
- mutation: updateSurgeryEvent
- query: getSurgeryEvent

#### Food Catalog

- query: searchFoods — text search + optional stage/category filters
- query: getFoodDetail
- query: getFoodAliases
- mutation: createUserFoodItem
- mutation: updateUserFoodItem
- action: vectorSearchFoods — semantic food matching via embeddings

#### Logging

- mutation: logMeal
- mutation: logOutput
- mutation: logSleep
- mutation: logActivity
- mutation: logStress
- mutation: logMedication
- mutation: logStimulant
- mutation: updateLog
- mutation: deleteLog
- query: getLogsByDateRange
- query: getRecentLogs

#### Capture & Parsing

- action: parseFoodInput — NLP text/voice → structured meal draft
- mutation: saveCaptureEvent — raw input stored for audit/reprocessing
- query: getCaptureEvent

#### Insights & Trends

- query: getTodayInsights
- query: getTrendCards
- query: getDailyTransitInsight
- query: getFoodToleranceScores
- query: getWeeklyDigest

#### Food Experiment

- mutation: createExperiment
- mutation: updateExperiment
- query: getActiveExperiments
- query: getExperimentDetail

#### AI Coach

- action: sendCoachMessage — sends user message, retrieves context, calls LLM, stores response
- query: getThreadMessages — paginated conversation history
- mutation: createThread
- query: getThreads
- mutation: updateMemoryFile — user edits to remembered preferences
- query: getMemoryFiles

#### Artifacts & Reports

- action: generateArtifact — meal plan, report, experiment card, etc.
- query: getArtifact
- query: listArtifacts
- action: exportPdf — generates PDF for sharing

#### Scheduled Functions (background)

- cron: computeDailyInsights — nightly recalculation of transit insights and tendency scores
- cron: generateWeeklyDigest — weekly summary computation
- scheduled: updateToleranceScores — triggered after each new log
- scheduled: refreshTodayRecommendations — triggered after log or tolerance score change
- scheduled: updateAiMemorySummary — triggered after meaningful coach sessions

#### Function Design Notes

- Use idempotency patterns for log submission (client-generated request IDs to prevent duplicate writes on retry)
- Return structured recommendation payloads separate from natural-language coach text
- Include ruleSetVersion and confidence fields in insight responses
- Every query and mutation must validate user ownership before returning or modifying data

### 5.9 Operational Readiness

- environments: dev, staging, production
- CI/CD with Play Store internal testing track; web app deployed via standard static hosting (Vercel)
- output image analysis
- feature flags for:
  - barcode scanning and branded product lookup
  - web search in coach
  - proactive AI nudges
  - Health Connect integration
- crash reporting and privacy-safe analytics
- model output monitoring and harmful-response review workflow
- Privacy-safe analytics (no ad trackers, no personally identifiable data in analytics events)
- Recommendation rule versioning — all food stage assignments and guidance rules are versioned in the database, not hardcoded in application logic alone
- content approval workflow for rule sets and food guidance

### 5.10 Recommended Release Sequencing

#### MVP

- onboarding and surgery profile
- stage-based food library with 100 seeded foods
- voice logging
- output logging with AI Photo Analysis fall back to Bristol scale
- Today guidance
- food experiments workflow
- meal planning and shopping list
- non-judgmental badges and rhythms
- Android app (Google Play) + Chrome web app
- basic trend cards
- AI coach with persistent memory
- PDF report for sharing with aftercare team
- privacy/security baseline

#### Phase 1

- Health Connect / Google Fit imports (steps, sleep)
- web research mode with citations in coach
- richer proactive coaching
- barcode scan + branded product cache
- food image recognition for meal logging
- iOS app (App Store)
- polished web version with full feature parity

### 5.11 Questions That Required Clarification Before Full Build

Because the original requirement payload was missing, the following have been confirmed:

- **Surgery types at launch:**
  - Right and left colectomy resulting in a stoma, colostomy reversal, ileostomy reversal.
- **Geographic markets and languages:**
  - UK, US, Canada, Australia. English as primary language, Spanish as secondary. EU regulations apply (company registered in Spain). First customers will be Spanish-speaking via local connections or international English speakers found through Reddit, Facebook, X, and similar communities.
- **Pediatric use:**
  - Not in scope. Adults only.
- **Caregiver/proxy accounts:**
  - Export only. Reports shared via email, WhatsApp, standard phone share options, or print/PDF. No live portal
- **Live clinician portal access:**
  - No live portal access required. Export only.
- **Branded food support:**
  - No paid commercial data sources. Use free sources (e.g., Open Food Facts) when barcode scanning is added in a later phase.
- **Stool photo analysis:**
  - yes, although it might be referenced throughout the spec as out of scope the user has instructed it to progress as a primary source of BM logging.
- **Timing guidance conservatism:**
  - Broad and general defaults until the Bayesian engine calibrates the user's own timings from their input and output data.
- **FHIR export/integration:**
  - Not in scope for launch. Possible later addition.
- **Local-only / offline-first guest mode:**
  - Not in scope. The app requires an internet connection.

### 5.12 Final Implementation Notes

- The user's aftercare team instructions (entered during onboarding as free text) should always be surfaced when relevant and should influence the recommendation engine's output.
- The app should degrade gracefully when data is sparse — useful guidance from day one, even with only a surgery date and type.
- The AI should explain uncertainty rather than overstate confidence.
- The default user experience should remain useful even if the user only logs a few meals and outputs per week.
- The most important promise of the product is not "perfect prediction" — it is calm, low-friction, privacy-respecting support during recovery.
- The app must always be honest about what it knows and what it is guessing. If confidence is low, show it in the UI. If the AI is unsure, it should say so.
