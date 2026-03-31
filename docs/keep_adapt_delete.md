# File Assessment for Wellness App (Position 2)

KEEP = Bring as-is. Already compliant or no medical framing.  
 ADAPT = Bring but needs changes. Compliant structure, non-compliant content (terminology, labels,  
 some logic). Less than 50% rewrite.  
 DELETE = Don't bring. Either >50% rewrite needed, or entirely surgery/repro-specific.

---

Convex Backend (37 files)

File: convex/schema.ts  
 Verdict: DELETE  
 Reason: Surgery types, recovery stages, reproductive health, "culprit" verdicts baked into field
definitions. Rewrite from scratch using the current one as reference.  
 ────────────────────────────────────────  
 File: convex/validators.ts  
 Verdict: DELETE  
 Reason: Surgery type enum, comorbidities array, reproductive health validators, 45+ clinical  
 fields.  
 Rebuild as wellness profile.  
 ────────────────────────────────────────  
 File: convex/logs.ts  
 Verdict: KEEP  
 Reason: Core CRUD. Log types (food, digestion, habit, activity, fluid, weight) are all wellness.
────────────────────────────────────────  
 File: convex/logs.test.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: convex/ai.ts  
 Verdict: ADAPT  
 Reason: Remove surgery-type-aware branching. Keep API key handling and OpenAI client.  
 ────────────────────────────────────────  
 File: convex/aiAnalyses.ts  
 Verdict: ADAPT  
 Reason: Rename "culprit" fields. Keep storage/query structure.  
 ────────────────────────────────────────
File: convex/aiAnalyses.test.ts  
 Verdict: ADAPT  
 Reason:  
 ────────────────────────────────────────  
 File: convex/computeAggregates.ts
Verdict: ADAPT
Reason: Remove surgery-aware transit windows and verdict computation. Keep aggregation counts
(times
eaten, co-occurrence counts). The aggregation structure is useful — it just needs to output
observations not verdicts.
────────────────────────────────────────
File: convex/computeAggregates.test.ts
Verdict: ADAPT
Reason:
────────────────────────────────────────
File: convex/conversations.ts  
 Verdict: KEEP
Reason: Chat storage. Generic.  
 ────────────────────────────────────────  
 File: convex/conversations.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/extractInsightData.ts  
 Verdict: ADAPT
Reason: Rename "clinicalReasoning" field. Keep extraction structure.  
 ────────────────────────────────────────  
 File: convex/extractInsightData.test.ts  
 Verdict: ADAPT  
 Reason:
────────────────────────────────────────
File: convex/foodAssessments.ts  
 Verdict: ADAPT
Reason: Remove "safe/avoid/watch/culprit" verdict system. Replace with user-curated status  
 ("agrees", "disagree", "untried", "not for me"). The table becomes user-driven, not  
 engine-driven.  
 ────────────────────────────────────────  
 File: convex/foodAssessments.test.ts  
 Verdict: ADAPT
Reason:  
 ────────────────────────────────────────  
 File: convex/foodLibrary.ts  
 Verdict: KEEP  
 Reason: User's personal food library. Generic.  
 ────────────────────────────────────────  
 File: convex/foodLibrary.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/foodLlmMatching.ts  
 Verdict: ADAPT
Reason: Remove surgery-aware prompt context from LLM food matching. Keep fuzzy + LLM matching flow.
────────────────────────────────────────  
 File: convex/foodParsing.ts  
 Verdict: KEEP  
 Reason: Food input parsing. Generic.  
 ────────────────────────────────────────  
 File: convex/foodParsing.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/foodRequests.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: convex/ingredientExposures.ts  
 Verdict: ADAPT  
 Reason: Remove recoveryStage field. Keep exposure tracking (times eaten, co-occurrence data).  
 ────────────────────────────────────────  
 File: convex/ingredientExposures.test.ts  
 Verdict: ADAPT  
 Reason:  
 ────────────────────────────────────────  
 File: convex/ingredientOverrides.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/ingredientOverrides.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: convex/ingredientNutritionApi.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/ingredientProfileProjection.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: convex/ingredientProfiles.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/ingredientProfiles.test.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: convex/lib/apiKeys.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: convex/lib/auth.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/lib/inputSafety.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: convex/lib/knownFoods.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: convex/profiles.ts  
 Verdict: ADAPT  
 Reason: Remove surgery/repro fields from profile mutations.  
 ────────────────────────────────────────  
 File: convex/profiles.test.ts  
 Verdict: ADAPT  
 Reason:
────────────────────────────────────────
File: convex/migrations.ts  
 Verdict: DELETE
Reason: Surgery-specific migrations. Won't apply to new schema.  
 ────────────────────────────────────────  
 File: convex/migrations.test.ts  
 Verdict: DELETE  
 Reason:  
 ────────────────────────────────────────  
 File: convex/seedTestData.ts  
 Verdict: DELETE  
 Reason: Test data references surgery types and recovery stages.  
 ────────────────────────────────────────  
 File: convex/testFixtures.ts  
 Verdict: DELETE  
 Reason: Same.
────────────────────────────────────────
File: convex/stripe.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: convex/waitlist.ts  
 Verdict: ADAPT  
 Reason: Remove surgeryType, recoveryStage fields.  
 ────────────────────────────────────────  
 File: convex/waitlist.test.ts  
 Verdict: ADAPT  
 Reason:
────────────────────────────────────────
File: convex/weeklySummaries.ts  
 Verdict: ADAPT
Reason: Remove "culprit" language and verdict summaries. Keep counts and co-occurrence stats.  
 ────────────────────────────────────────  
 File: convex/weeklySummaries.test.ts  
 Verdict: ADAPT  
 Reason:  
 ────────────────────────────────────────  
 File: convex/auth.config.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: convex/\_generated/\*  
 Verdict: DELETE
Reason: Auto-generated. Will regenerate.  
 ────────────────────────────────────────  
 File: convex/aggregateQueries.ts  
 Verdict: ADAPT  
 Reason: Remove verdict-based queries (foodTrialsByStatus). Keep count-based queries.  
 ────────────────────────────────────────  
 File: convex/aggregateQueries.test.ts  
 Verdict: ADAPT  
 Reason:

Convex totals: 19 KEEP, 18 ADAPT, 8 DELETE

---

Shared — Food Pipeline (16 files)

File: shared/foodRegistry.ts  
 Verdict: KEEP  
 Reason: Barrel file.  
 ────────────────────────────────────────  
 File: shared/foodRegistryData.ts  
 Verdict: ADAPT  
 Reason: Remove zone assignments (1/2/3 tied to surgical recovery). Keep the 147 foods as a starter
pack directory. Foods become suggestions, not prescriptions.  
 ────────────────────────────────────────  
 File: shared/foodRegistryUtils.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: shared/foodMatching.ts  
 Verdict: KEEP  
 Reason: Fuzzy matching, Fuse.js, candidate scoring. All generic.  
 ────────────────────────────────────────  
 File: shared/foodNormalize.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: shared/foodParsing.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: shared/foodCanonicalization.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: shared/foodCanonicalName.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────
File: shared/foodProjection.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: shared/foodEvidence.ts
Verdict: DELETE
Reason: 1492 LOC. Surgery-type transit windows, "culprit" Bayesian scoring, recovery zone
weighting,
trigger correlation model, clinical Bristol interpretation. The entire function is to assign
causation verdicts — which Position 2 explicitly does not do. Rewrite as a simple co-occurrence
counter.
────────────────────────────────────────
File: shared/foodTypes.ts  
 Verdict: ADAPT
Reason: Remove verdict types ("safe"/"avoid"/"watch"/"culprit"), surgery-related type definitions.
Keep food item types.  
 ────────────────────────────────────────  
 File: shared/logDataParsers.ts  
 Verdict: KEEP
Reason:
────────────────────────────────────────
File: shared/**tests**/foodEvidence\*.test.ts (4 files)  
 Verdict: DELETE
Reason: Tests for the evidence engine being deleted.  
 ────────────────────────────────────────  
 File: shared/**tests**/foodCanonicalization.test.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: shared/**tests**/foodMatchCandidates.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: shared/**tests**/foodMatching.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: shared/**tests**/foodNormalize.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: shared/**tests**/foodParsing.test.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: shared/**tests**/foodPipelineDisplay.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: shared/**tests**/foodRegistry.test.ts  
 Verdict: KEEP  
 Reason:

Shared totals: 13 KEEP, 2 ADAPT, 5 DELETE

---

src/lib — Core Logic (55 files)

File: aiAnalysis.ts  
 Verdict: DELETE  
 Reason: 2657 LOC. "Clinical reasoning engine," surgery-type transit windows, post-op timeline,  
 Bristol risk interpretation, stalled transit protocol, elimination diet suggestions, symptom  
 triage questions, "Likely Suspect" classification. Every paragraph assigns causation or
prescribes  
 action. Position 2 needs a completely different prompt: a data narrator + a separate coach.
Rewrite from scratch.  
 ────────────────────────────────────────  
 File: habitCoaching.ts  
 Verdict: DELETE  
 Reason: 497 LOC. "Post-surgery anastomosis recovery patient" hardcoded in coaching prompts.  
 Coaching  
 content frames all guidance through surgical recovery and suggests dietary actions. Position 2
coaching needs to be goal-based and user-directed, not condition-based.
────────────────────────────────────────
File: foodStatusThresholds.ts  
 Verdict: DELETE
Reason: 367 LOC. Surgery-type Bristol expectations, clinical risk language ("dehydration risk",  
 "straining on anastomosis site"), recovery zones (1/2/3), verdict thresholds. The entire file  
 exists to classify foods as safe/watch/avoid — which Position 2 does not do.  
 ────────────────────────────────────────  
 File: reproductiveHealth.ts  
 Verdict: DELETE
Reason: 100% reproductive.  
 ────────────────────────────────────────  
 File: healthProfile.ts  
 Verdict: ADAPT  
 Reason: Small (35 LOC). Remove surgery references.  
 ────────────────────────────────────────  
 File: analysis.ts  
 Verdict: ADAPT  
 Reason: bristolToConsistency mapping stays (Bristol is fine for wellness). Soften descriptor names:

    "constipated" → "firm/hard", "diarrhea" → "loose/watery". Remove any risk language.

────────────────────────────────────────  
 File: analysis.test.ts  
 Verdict: ADAPT
Reason:  
 ────────────────────────────────────────  
 File: foodDigestionMetadata.ts  
 Verdict: ADAPT  
 Reason: Replace surgery-specific transit values with general population averages. Frame as  
 approximate, not personalised.  
 ────────────────────────────────────────  
 File: foodLlmCanonicalization.ts  
 Verdict: KEEP
Reason:
────────────────────────────────────────
File: foodParsing.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: baselineAverages.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: derivedHabitLogs.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: habitProgress.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: habitTemplates.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: habitAggregates.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: habitConstants.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: habitIcons.tsx  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: celebrations.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: sounds.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: customFoodPresets.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: dateUtils.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: debugLog.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: errors.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: formatWeight.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: inputSafety.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: normalizeFluidName.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: units.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: utils.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: timeConstants.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: trialFormatters.ts  
 Verdict: ADAPT
Reason: Rename "trial" → "experience" or "entry" in display strings.  
 ────────────────────────────────────────  
 File: featureFlags.ts  
 Verdict: ADAPT  
 Reason: Remove reproductiveHealth flag.
────────────────────────────────────────
File: sync.ts  
 Verdict: ADAPT
Reason: Remove repro log type handling.  
 ────────────────────────────────────────  
 File: syncCore.ts  
 Verdict: ADAPT  
 Reason: Remove repro type branch.  
 ────────────────────────────────────────  
 File: syncLogs.ts  
 Verdict: ADAPT  
 Reason: Remove repro type branch.
────────────────────────────────────────
File: syncAi.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: syncFood.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: syncWeekly.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: aiModels.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: aiRateLimiter.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: aiMarkdownComponents.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: convexAiClient.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: apiKeyStore.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: chakraColors.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: motionVariants.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: settingsUtils.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: streaks.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: migrateLegacyStorage.ts  
 Verdict: DELETE
Reason: Dead migration.  
 ────────────────────────────────────────  
 File: **tests**/aiAnalysis.test.ts  
 Verdict: DELETE  
 Reason: Tests for deleted file.  
 ────────────────────────────────────────  
 File: **tests**/foodStatusThresholds.test.ts  
 Verdict: DELETE  
 Reason: Tests for deleted file.  
 ────────────────────────────────────────  
 File: **tests**/aiModels.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: **tests**/analysis.test.ts  
 Verdict: ADAPT
Reason:  
 ────────────────────────────────────────  
 File: **tests**/baselineAverages.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: **tests**/derivedHabitLogs.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: **tests**/foodLlmCanonicalization.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: **tests**/foodParsing.behavior.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: **tests**/foodParsing.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: **tests**/formatWeight.test.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: **tests**/habitAggregates.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: **tests**/habitProgress.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: **tests**/habitTemplates.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: **tests**/healthProfile.test.ts  
 Verdict: ADAPT  
 Reason:
────────────────────────────────────────
File: **tests**/inputSafety.test.ts  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: **tests**/normalizeFluidName.test.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: **tests**/sync.test.ts
Verdict: ADAPT
Reason:

src/lib totals: 37 KEEP, 12 ADAPT, 7 DELETE

---

src/components — UI (130+ files)

Landing Page (14 files)

┌─────────────────────────────┬─────────┬───────────────────────────────────────────────────────┐
│ File │ Verdict │ Reason │
├─────────────────────────────┼─────────┼───────────────────────────────────────────────────────┤
│ landing/HeroSection.tsx │ DELETE │ "Anastomosis Recovery", "ileostomy & colostomy │
│ │ │ reversal patients". New brand, new copy. │
├─────────────────────────────┼─────────┼───────────────────────────────────────────────────────┤  
 │ landing/FeaturesSection.t
src/components — UI (130+ files)

Landing Page (14 files)

┌──────────────────────────────────┬─────────┬──────────────────────────────────────────────────┐
│ File │ Verdict │ Reason │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
│ landing/HeroSection.tsx │ DELETE │ "Anastomosis Recovery", "ileostomy & colostomy │
│ │ │ reversal patients". New brand, new copy. │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/FeaturesSection.tsx │ DELETE │ "AI gastroenterologist". Every feature │
│ │ │ description frames the app as a clinical tool. │  
 ├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
│ landing/ProblemSection.tsx │ DELETE │ "Eating after surgery". Problem statement is │  
 │ │ │ medical. │  
 ├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
│ landing/HowItWorksSection.tsx │ ADAPT │ Step descriptions likely have medical language │  
 │ │ │ but the component structure is reusable. │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/WaitlistForm.tsx │ ADAPT │ Remove surgery type / recovery stage fields. │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/ApiKeyFooterSection.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/BackToTop.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/BetaTestSection.tsx │ ADAPT │ May have medical copy. │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/ChakraBar.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/LandingNav.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/LandingFooter.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/PhoneFrame.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/PricingCard.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/PricingSection.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
│ landing/ScrollArrow.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/SectionShell.tsx │ KEEP │ │
├──────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤  
 │ landing/legal/LegalPageShell.tsx │ KEEP │ │
└──────────────────────────────────┴─────────┴──────────────────────────────────────────────────┘

Landing totals: 10 KEEP, 3 ADAPT, 3 DELETE

Settings (35 files)

File: settings/repro/CycleSection.tsx  
 Verdict: DELETE  
 Reason: 100% reproductive.  
 ────────────────────────────────────────  
 File: settings/repro/DatePickerButton.tsx  
 Verdict: DELETE  
 Reason: Only used by repro.  
 ────────────────────────────────────────  
 File: settings/repro/MenopauseSection.tsx  
 Verdict: DELETE  
 Reason:  
 ────────────────────────────────────────  
 File: settings/repro/PregnancySection.tsx  
 Verdict: DELETE  
 Reason:  
 ────────────────────────────────────────  
 File: settings/repro/index.ts  
 Verdict: DELETE  
 Reason:  
 ────────────────────────────────────────  
 File: settings/repro/types.ts  
 Verdict: DELETE  
 Reason:  
 ────────────────────────────────────────  
 File: settings/ReproForm.tsx  
 Verdict: DELETE  
 Reason:  
 ────────────────────────────────────────  
 File: settings/health/SurgerySection.tsx  
 Verdict: DELETE  
 Reason: Surgery type enum, surgery date, "low-residue food progression."
────────────────────────────────────────
File: settings/app-data-form/ReproductiveHealthSection.tsx
Verdict: DELETE
Reason:
────────────────────────────────────────
File: settings/health/ConditionsSection.tsx
Verdict: ADAPT
Reason: Replace "GI medical conditions" / "Comorbidities" → "Dietary considerations" / "Health
notes". Structure reusable.
────────────────────────────────────────
File: settings/health/MedicationsSection.tsx  
 Verdict: ADAPT
Reason: Replace GI-specific placeholders. Keep structure.  
 ────────────────────────────────────────  
 File: settings/health/DemographicsSection.tsx  
 Verdict: KEEP  
 Reason: Age, gender. Generic.  
 ────────────────────────────────────────  
 File: settings/health/DietarySection.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/health/LifestyleSection.tsx  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: settings/health/SubstanceTrackingField.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/health/ChipGroup.tsx  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: settings/health/index.ts  
 Verdict: ADAPT  
 Reason: Remove SurgerySection export.  
 ────────────────────────────────────────  
 File: settings/health/types.ts  
 Verdict: ADAPT  
 Reason: Remove surgery types.
────────────────────────────────────────
File: settings/HealthForm.tsx  
 Verdict: ADAPT
Reason: Remove SurgerySection import.  
 ────────────────────────────────────────  
 File: settings/app-data-form/ArtificialIntelligenceSection.tsx  
 Verdict: ADAPT  
 Reason: Rename persona references.  
 ────────────────────────────────────────  
 File: settings/app-data-form/CloudProfileSection.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/app-data-form/DataManagementSection.tsx  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: settings/app-data-form/UnitsSection.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/app-data-form/index.ts  
 Verdict: ADAPT
Reason: Remove ReproductiveHealthSection export.  
 ────────────────────────────────────────  
 File: settings/app-data-form/shared.ts  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: settings/app-data-form/useAppDataFormController.ts  
 Verdict: ADAPT  
 Reason: Remove repro/surgery field handling.  
 ────────────────────────────────────────  
 File: settings/tracking-form/DrPooSection.tsx  
 Verdict: ADAPT  
 Reason: Rename persona. Keep preference controls.  
 ────────────────────────────────────────  
 File: settings/tracking-form/DrPooPreviewComponents.tsx  
 Verdict: ADAPT  
 Reason:  
 ────────────────────────────────────────  
 File: settings/tracking-form/DrPooSliderControl.tsx  
 Verdict: ADAPT  
 Reason:  
 ────────────────────────────────────────  
 File: settings/tracking-form/drPooPreviewData.ts  
 Verdict: ADAPT  
 Reason:  
 ────────────────────────────────────────  
 File: settings/tracking-form/CelebrationsSection.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/tracking-form/CustomDrinksSection.tsx  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: settings/tracking-form/HiddenHabitsSection.tsx  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: settings/tracking-form/QuickCaptureDefaultsSection.tsx  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: settings/tracking-form/index.ts  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/tracking-form/shared.ts
Verdict: KEEP
Reason:
────────────────────────────────────────
File: settings/AppDataForm.tsx  
 Verdict: ADAPT
Reason: Remove repro tab.  
 ────────────────────────────────────────  
 File: settings/CollapsibleSectionHeader.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/DeleteConfirmDrawer.tsx  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: settings/FoodPersonalisationSection.tsx  
 Verdict: KEEP  
 Reason:  
 ────────────────────────────────────────  
 File: settings/PersonalisationForm.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/SettingsSelect.tsx  
 Verdict: KEEP
Reason:  
 ────────────────────────────────────────  
 File: settings/SettingsTile.tsx  
 Verdict: KEEP  
 Reason:
────────────────────────────────────────
File: settings/TrackingForm.tsx
Verdict: KEEP
Reason:
────────────────────────────────────────
File: settings/AiSuggestionsCard.tsx  
 Verdict: KEEP
Reason:

Settings totals: 22 KEEP, 14 ADAPT, 9 DELETE

Track — Panels, Dr Poo, Quick Capture, Today Log (55 files)

┌─────────────────────────────────────────────────┬─────────┬───────────────────────────────────┐  
 │ File │ Verdict │ Reason │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/panels/CycleHormonalSection.tsx │ DELETE │ 100% reproductive. │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/today-log/editors/ReproductiveSubRow.tsx │ DELETE │ │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/groups/ReproductiveGroupRow.tsx │ DELETE │ │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/panels/BristolScale.tsx │ KEEP │ Bristol 1-7 presented neutrally. │
│ │ │ Wellness-appropriate. │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/panels/bristolScaleData.ts │ KEEP │ │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/panels/BowelSection.tsx │ ADAPT │ Consider renaming "bowel" to │
│ │ │ "digestion" for softer framing. │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/panels/bowelConstants.ts │ ADAPT │ Same — soften terminology. │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/panels/FoodSection.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/panels/FluidSection.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ │ │ May reference transit window in │
│ track/panels/ObservationWindow.tsx │ ADAPT │ medical terms. Reframe as "your │  
 │ │ │ food timeline" or similar. │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/panels/PanelTimePicker.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/panels/index.ts │ ADAPT │ Remove CycleHormonalSection │
│ │ │ export. │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/dr-poo/AiInsightsSection.tsx │ ADAPT │ Replace stethoscope icon. Rename │  
 │ │ │ "Dr. Poo" → new persona. │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/dr-poo/AiInsightsBody.tsx │ ADAPT │ │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/dr-poo/ConversationPanel.tsx │ KEEP │ Chat UI. Generic. │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/dr-poo/ReplyInput.tsx │ ADAPT │ "Reply to Dr. Poo" aria label → │
│ │ │ new name. │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/FoodMatchingModal.tsx │ KEEP │ │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/RawInputEditModal.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/TodayStatusRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/AddHabitDrawer.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/DurationEntryPopover.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/HabitDetailSheet.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/QuickCapture.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/QuickCaptureTile.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/UnitAwareInput.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/WeightEntryDrawer.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/WeightTrendChart.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/constants.ts │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/index.ts │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/quick-capture/weightUtils.ts │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/today-log/AutoEditContext.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/TodayLog.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/TodayLogContext.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/editors/ActivitySubRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/editors/EditableEntryRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/editors/FluidSubRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/editors/FoodSubRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/editors/HabitSubRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/editors/WeightSubRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/editors/index.ts │ ADAPT │ Remove ReproductiveSubRow export. │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/grouping.ts │ ADAPT │ Remove repro group type. │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/groups/ActivityGroupRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/groups/FluidGroupRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/groups/FoodGroupRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/groups/HabitGroupRows.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/groups/WeightGroupRow.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/groups/index.ts │ ADAPT │ Remove ReproductiveGroupRow │
│ │ │ export. │  
 ├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/today-log/helpers.ts │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/index.ts │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/motion.ts │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ track/today-log/rows/LogEntry.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/rows/index.ts │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/types.ts │ ADAPT │ Remove repro log type. │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤  
 │ track/today-log/useAutoEditEntry.ts │ KEEP │ │
└─────────────────────────────────────────────────┴─────────┴───────────────────────────────────┘

Track totals: 38 KEEP, 14 ADAPT, 3 DELETE

Patterns — Database & Hero (16 files)

┌──────────────────────────────────────────┬─────────┬──────────────────────────────────────────┐  
 │ File │ Verdict │ Reason │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤
│ │ │ "safe/watch/avoid" → user-curated │
│ patterns/database/FilterSheet.tsx │ ADAPT │ statuses ("agrees/disagrees/untried/not │
│ │ │ for me"). │  
 ├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤
│ patterns/database/StatusBadge.tsx │ ADAPT │ Same vocabulary change. │  
 ├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤
│ patterns/database/foodSafetyUtils.ts │ ADAPT │ "foodSafety" → "foodTolerance" or │  
 │ │ │ "foodExperience". │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/database/columns.tsx │ ADAPT │ Column headers: "Safety Status" → "My │  
 │ │ │ Status" or "Experience". │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/database/TrialHistorySubRow.tsx │ ADAPT │ "Trial" → "Experience". │  
 ├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤
│ patterns/database/AiBadge.tsx │ KEEP │ │  
 ├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/database/BristolBreakdown.tsx │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ │ │ TanStack table. Generic. You may later │
│ patterns/database/DatabaseTable.tsx │ KEEP │ replace this with the three-list UI, but │  
 │ │ │ the component itself is fine. │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/database/TrendIndicator.tsx │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/database/SmartViews.tsx │ ADAPT │ May reference "safe foods" etc. │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/database/filterUtils.ts │ ADAPT │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/database/index.ts │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/hero/BmFrequencyTile.tsx │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/hero/BristolTrendTile.tsx │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/hero/HeroStrip.tsx │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/hero/Sparkline.tsx │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/hero/index.ts │ KEEP │ │
├──────────────────────────────────────────┼─────────┼──────────────────────────────────────────┤  
 │ patterns/hero/utils.ts │ KEEP │ │
└──────────────────────────────────────────┴─────────┴──────────────────────────────────────────┘

Patterns totals: 10 KEEP, 8 ADAPT, 0 DELETE

Transit Map (20 files)

┌──────────────────────────────────────┬─────────┬──────────────────────────────────────────────┐  
 │ File │ Verdict │ Reason │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤
│ transit-map/constants.ts │ KEEP │ 95% geometry/colors. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤
│ transit-map/types.ts │ ADAPT │ Remove surgery-specific type fields. │  
 ├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/utils.ts │ KEEP │ │  
 ├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/TransitMapCanvas.tsx │ KEEP │ SVG rendering. Generic. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/TransitMapWithLabels.tsx │ KEEP │ │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/TrackSegment.tsx │ KEEP │ │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/StationNode.tsx │ KEEP │ │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/StationTooltip.tsx │ KEEP │ │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/ZoneCard.tsx │ ADAPT │ Zone descriptions need rewording (remove │
│ │ │ recovery stage references). │  
 ├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤
│ transit-map/useStationArtwork.ts │ KEEP │ │  
 ├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/useTransitScene.ts │ KEEP │ │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/TransitMapContainer.tsx │ DELETE │ V2 list-based. You want one implementation. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/LineTrack.tsx │ DELETE │ V2 list-based. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/StationMarker.tsx │ DELETE │ V2 list-based. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/StationInspector.tsx │ DELETE │ V2 list-based. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/TransitMap.tsx │ DELETE │ V1 model guide. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/TransitMapInspector.tsx │ DELETE │ V1 model guide. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/RegistryTransitMap.tsx │ DELETE │ V1 model guide. │
├──────────────────────────────────────┼─────────┼──────────────────────────────────────────────┤  
 │ transit-map/IntersectionNode.tsx │ DELETE │ V1 model guide. │
└──────────────────────────────────────┴─────────┴──────────────────────────────────────────────┘

Transit map totals: 9 KEEP, 2 ADAPT, 8 DELETE

UI Primitives (30 files)  
 ┌────────────────┬─────────┐
│ File │ Verdict │
├────────────────┼─────────┤
│ All ui/\* files │ KEEP │
└────────────────┴─────────┘

Every file (accordion, badge, button, calendar, card, checkbox, collapsible, date-picker, drawer,
dropdown-menu, input, label, navigation-menu, pagination, popover, responsive-shell, scroll-area,
separator, sheet, sonner, spinner, switch, tabs, toggle-group, toggle, tooltip, Confetti,
ErrorBoundary, Reassuring, SectionHeader, TimeInput, base-ui-utils, mode-toggle, theme-provider) is
a generic UI primitive.

UI totals: 30 KEEP, 0 ADAPT, 0 DELETE

Archive (4 files)

┌─────────────────────────────────────────────────┬─────────┬───────────────────────────────────┐
│ File │ Verdict │ Reason │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ archive/DrPooReport.tsx │ ADAPT │ Rename persona. Keep report │
│ │ │ display. │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ archive/ai-insights/AnalysisProgressOverlay.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ archive/ai-insights/MealIdeaCard.tsx │ KEEP │ │
├─────────────────────────────────────────────────┼─────────┼───────────────────────────────────┤
│ archive/ai-insights/index.ts │ KEEP │ │
└─────────────────────────────────────────────────┴─────────┴───────────────────────────────────┘

Archive totals: 3 KEEP, 1 ADAPT, 0 DELETE

---

Pages, Hooks, Contexts, Types, Other (30 files)

┌───────────────────────────────────────────────┬─────────┬─────────────────────────────────────┐
│ File │ Verdict │ Reason │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/Track.tsx │ ADAPT │ Remove repro section rendering. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/Patterns.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/Settings.tsx │ ADAPT │ Remove repro form tab. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/LandingPage.tsx │ ADAPT │ Compose rewritten landing sections. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ │ │ "Ostomy reversal surgery" │
│ pages/secondary_pages/TermsPage.tsx │ DELETE │ throughout. Write fresh with │
│ │ │ wellness framing. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/secondary_pages/PrivacyPage.tsx │ DELETE │ "Surgery type, recovery stage". │
│ │ │ Write fresh. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/secondary_pages/Archive.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/secondary_pages/Menu.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/secondary_pages/ApiKeyGuidePage.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ pages/UiMigrationLab.tsx │ DELETE │ Dev tool. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/App.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/main.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/routeTree.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/store.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/registerServiceWorker.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/vite-env.d.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ │ │ 2112 LOC of │
│ src/data/transitData.ts │ DELETE │ surgery-recovery-specific station │
│ │ │ data. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/types/domain.ts │ ADAPT │ Remove repro/surgery types. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/types/transitMap.ts │ ADAPT │ Remove surgery-specific fields. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/contexts/ApiKeyContext.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/contexts/ProfileContext.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/contexts/SyncedLogsContext.tsx │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useAiInsights.ts │ ADAPT │ Remove persona naming, keep insight │
│ │ │ fetching. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useAnalyzedFoodStats.ts │ ADAPT │ Remove verdict-based analysis. Keep │
│ │ │ count-based stats. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useApiKey.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useBaselineAverages.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useCelebration.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useCelebrationTrigger.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useDayStats.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useDetailSheetController.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useFoodLlmMatching.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useFoodParsing.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useHabitLog.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useHabitStreaks.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useLongPress.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useMappedAssessments.ts │ ADAPT │ Remove verdict mapping. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/usePanelTime.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/usePendingReplies.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useProfile.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useQuickCapture.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useTimePicker.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useTransitMapData.ts │ ADAPT │ Remove surgery-aware data mapping. │
│ │ │ Keep hierarchy builder. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useTransitMapGeometry.ts │ KEEP │ Pure geometry. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useTransitMapZoom.ts │ KEEP │ Pure state machine. │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useUnresolvedFoodQueue.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useUnresolvedFoodToast.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/useWeeklySummaryAutoTrigger.ts │ KEEP │ │
├───────────────────────────────────────────────┼─────────┼─────────────────────────────────────┤
│ src/hooks/**tests**/useTransitMapData.test.ts │ ADAPT │ │
└───────────────────────────────────────────────┴─────────┴─────────────────────────────────────┘

---

Final Totals

┌─────────┬───────┬─────┐
│ Verdict │ Count │ % │  
 ├─────────┼───────┼─────┤  
 │ KEEP │ ~162 │ 66% │  
 ├─────────┼───────┼─────┤  
 │ ADAPT │ ~55 │ 22% │  
 ├─────────┼───────┼─────┤
│ DELETE │ ~30 │ 12% │  
 └─────────┴───────┴─────┘

The 12 files that need to be written from scratch in the new repo (the DELETE files that represent
core functionality, not just repro removal):

1. convex/schema.ts — new wellness profile schema
2. convex/validators.ts — new wellness validators
3. shared/foodEvidence.ts — co-occurrence counter, no verdicts
4. src/lib/aiAnalysis.ts — data narrator prompt + coach prompt (Position 2)
5. src/lib/habitCoaching.ts — goal-based coaching, not condition-based
6. src/lib/foodStatusThresholds.ts — if needed at all; may be replaced by user-curated lists
7. src/data/transitData.ts — general population transit data
8. src/components/landing/HeroSection.tsx — new brand
9. src/components/landing/FeaturesSection.tsx — new features copy
10. src/components/landing/ProblemSection.tsx — new problem statement
11. src/pages/secondary_pages/TermsPage.tsx — wellness Terms
12. src/pages/secondary_pages/PrivacyPage.tsx — wellness Privacy  

Everything else either comes across as-is or needs terminology/label changes that are under 50% of
the file.
