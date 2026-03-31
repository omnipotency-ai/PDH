import { BadgeCheck, Moon, Target } from "lucide-react";
import type { ElementType } from "react";
import { ReassuringCoach } from "@/components/ui/Reassuring";
import type { Approach, DrPooPreset, OutputFormat, OutputLength, Register } from "@/types/domain";

// ── Types ───────────────────────────────────────────────────────────────────

export type PreviewText = {
  summary: string;
  suggestions: string;
  didYouKnow: string;
};

export type PreviewByLength = Record<OutputLength, PreviewText>;

export type PresetCard = {
  value: Exclude<DrPooPreset, "custom">;
  label: string;
  description: string;
  Icon: ElementType<{ className?: string }>;
  preview: PreviewByLength;
};

export type AxisOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

export type AdvancedPreviewSet = {
  heading: string;
  standard: PreviewText;
  concise: PreviewText;
  detailed: PreviewText;
};

// ── Axis option arrays ──────────────────────────────────────────────────────

export const APPROACH_OPTIONS = [
  {
    value: "supportive",
    label: "Supportive",
    description: "Warm, encouraging tone that leads with reassurance.",
  },
  {
    value: "personal",
    label: "Personal",
    description: "Human and direct, like a trusted clinician who knows you.",
  },
  {
    value: "analytical",
    label: "Analytical",
    description: "Evidence-first, neutral tone focused on mechanism.",
  },
] as const satisfies readonly AxisOption<Approach>[];

export const REGISTER_OPTIONS = [
  {
    value: "everyday",
    label: "Everyday language",
    description: "Plain words with minimal jargon.",
  },
  {
    value: "mixed",
    label: "Balanced language",
    description: "Everyday language plus key clinical terms.",
  },
  {
    value: "clinical",
    label: "Clinical language",
    description: "Medical terminology with precision.",
  },
] as const satisfies readonly AxisOption<Register>[];

export const STRUCTURE_OPTIONS = [
  {
    value: "narrative",
    label: "Mostly prose",
    description: "Paragraph-led responses.",
  },
  {
    value: "mixed",
    label: "Prose + bullets",
    description: "Balanced paragraphs and bullet points.",
  },
  {
    value: "structured",
    label: "Bullets first",
    description: "Compact, list-driven responses.",
  },
] as const satisfies readonly AxisOption<OutputFormat>[];

export const LENGTH_OPTIONS = [
  {
    value: "concise",
    label: "Concise",
    description: "Only essential points.",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Balanced depth and speed.",
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Full reasoning and extra context.",
  },
] as const satisfies readonly AxisOption<OutputLength>[];

// ── Label records ───────────────────────────────────────────────────────────

export const APPROACH_LABELS: Record<Approach, string> = {
  supportive: "Supportive",
  personal: "Personal",
  analytical: "Analytical",
};

export const REGISTER_LABELS: Record<Register, string> = {
  everyday: "Everyday",
  mixed: "Balanced",
  clinical: "Clinical",
};

export const STRUCTURE_LABELS: Record<OutputFormat, string> = {
  narrative: "Prose",
  mixed: "Mixed",
  structured: "Bullets",
};

export const LENGTH_LABELS: Record<OutputLength, string> = {
  concise: "Concise",
  standard: "Standard",
  detailed: "Detailed",
};

// ── Preset cards ────────────────────────────────────────────────────────────
// Each preset maps to an approach+register combo. We look up the matching
// previews from ADVANCED_PREVIEW_MATRIX so the preset previews show all 3
// lengths too.

export const PRESET_CARDS: PresetCard[] = [
  {
    value: "reassuring_coach",
    label: "Reassuring Coach",
    description: "Cheerleader energy with adult terms and gentle explanations.",
    Icon: ReassuringCoach,
    // supportive + mixed
    preview: {
      standard: {
        summary:
          "You nailed a Bristol 4 this morning \u2013 that\u2019s your bowel showing it can form proper, healthy\u2011looking stool now. Amazing progress. The two looser Bristol 6 stools that followed, plus the long 16\u2011hour pause, are almost certainly your Aquarius pulling extra water into the gut, not a sign that your foods are \u201cwrong.\u201d",
        suggestions:
          "For the next 24 hours, think of giving your anastomosis \u2013 the surgical join in your bowel \u2013 a calm, spa\u2011day shift. Keep to your safe, simple foods and choose wet, soothing meals so things can glide without any straining. When you sit to pee, just relax and notice your breath; if something wants to come, it will. No pushing needed.",
        didYouKnow:
          "It\u2019s completely possible to see a solid Bristol 4, then a couple of Bristol 6 stools, then a long pause. That mix happens because water movement in the gut changes very quickly, especially when drinks like Aquarius pull extra fluid into the colon.",
      },
      concise: {
        summary:
          "- Bristol 4 this morning \u2013 bowel forming stool well\n- Bristol 6s after = Aquarius osmotic pull\n- 16h pause = normal post-fluid recovery\n- Foods on track, drink caused the wobble",
        suggestions: "- Pause sugary drinks\n- Relaxed toilet sits only, protect anastomosis",
        didYouKnow: "Water shifts cause the 4\u21926\u2192pause pattern.",
      },
      detailed: {
        summary:
          "You nailed a Bristol 4 this morning \u2013 that\u2019s your bowel demonstrating it can absorb enough water to form a proper, healthy\u2011looking stool. This is a genuinely encouraging sign at your recovery stage, because it means the anastomosis (surgical join) is allowing normal colonic water absorption to resume.\n\nThe two looser Bristol 6 stools that followed, plus the long 16\u2011hour pause, are almost certainly caused by the osmotic effect of Aquarius. Sugary drinks pull extra water into the colon through a process called osmosis \u2013 the sugar molecules attract water across the intestinal wall, which makes your stool runnier temporarily. Once that extra fluid passes through, your colon needs time to reset, which explains the long quiet period afterwards.\n\nYour safe foods are doing their job perfectly; this was a drink effect, not a food failure. You\u2019re moving in the right direction.",
        suggestions:
          "For the next 24 hours, think of giving your anastomosis a calm, spa\u2011day shift. Here\u2019s why each step matters:\n\n- Pause sugary drinks like Aquarius \u2013 they create the osmotic water pull that loosened your stool\n- Stick to plain water, herbal tea, or clear broth \u2013 these hydrate without disturbing your colon\u2019s water balance\n- Eat smaller, softer meals more often \u2013 smaller portions are gentler on a healing join\n- When you sit to pee, relax and notice your breath \u2013 relaxation helps the pelvic floor open naturally\n- No pushing needed \u2013 straining increases pressure on the anastomosis, which is still healing\n- Set a timer for 5\u20138 minutes of relaxed sitting; stand up if nothing happens",
        didYouKnow:
          "It\u2019s completely possible to see a solid Bristol 4, then a couple of Bristol 6 stools, then a long pause \u2013 all in the same day. This happens because of how quickly your colon\u2019s water handling can shift. When you drink something sugary like Aquarius, the sugar creates an osmotic gradient: water rushes from your blood vessels into the colon to dilute the sugar. This floods the stool with extra liquid, producing the Bristol 6s. Once the sugar passes through, the colon starts reabsorbing water normally again, but it takes hours to catch up \u2013 hence the long pause. Your BRAT foods helped create that first solid stool by providing gentle, easily absorbed nutrients. The drink just added a temporary watery twist.",
      },
    },
  },
  {
    value: "clear_clinician",
    label: "Clear Clinician",
    description: "Professional letter tone, reassuring but with clinical language and mechanisms.",
    Icon: BadgeCheck,
    // personal + clinical
    preview: {
      standard: {
        summary:
          "Hi Peter. From a clinical point of view, today\u2019s pattern is acceptable for your stage: an initial Bristol type 4 stool indicates good formation, while the subsequent Bristol type 6 stools and prolonged absence of further output are most consistent with the osmotic effect of Aquarius, rather than a complication at the anastomosis.",
        suggestions:
          "In your case, a 14\u201316\u2011hour interval without defecation is not worrisome provided there is no significant abdominal pain, progressive distension, or vomiting. Over the next 24 hours, I\u2019d recommend low\u2011residue, high\u2011moisture meals and strict avoidance of straining to protect the anastomotic site.",
        didYouKnow:
          "It is clinically common to observe a formed Bristol 4 stool followed by looser Bristol 6 episodes and then a prolonged interval without output. This pattern typically reflects shifts in luminal water and transit rather than obstruction or anastomotic failure.",
      },
      concise: {
        summary:
          "- Bristol 4 = good colonic formation\n- Bristol 6s + pause = Aquarius osmotic effect\n- No anastomotic concern indicated",
        suggestions:
          "- Discontinue Aquarius\n- No straining, protect anastomosis\n- Low\u2011residue, high\u2011moisture diet",
        didYouKnow: "Osmotics cause transient loose output then compensatory pause.",
      },
      detailed: {
        summary:
          "Hi Peter. From a clinical perspective, today\u2019s pattern is acceptable and even encouraging for your recovery stage. The initial Bristol type 4 stool indicates that your colon is successfully reabsorbing water from the faecal stream \u2013 a key milestone. The colonic epithelium is functioning well enough to produce formed stool, which means the anastomosis is not significantly disrupting normal bowel physiology.\n\nThe subsequent Bristol type 6 stools and the prolonged 16\u2011hour absence of further output are most consistent with the osmotic effect of Aquarius. When a hypertonic fluid reaches the colon, it draws water across the intestinal mucosa by osmosis, increasing the liquid content of stool. Once the osmotic load passes, the colon\u2019s normal water absorption resumes, but there is a recovery lag \u2013 hence the extended pause. Your BRAT\u2011type foods clearly supported the formed stool; the drink introduced the water shift.",
        suggestions:
          "A 14\u201316\u2011hour interval without defecation is not worrisome provided there is no significant abdominal pain, progressive distension, or vomiting. Here is a structured plan:\n\n- Discontinue Aquarius immediately \u2013 the high sugar content creates an osmotic gradient that loosens stool\n- Replace with plain water or ORS \u2013 these replace electrolytes without the osmotic load\n- Low\u2011residue meals every 3\u20134 hours to reduce mechanical stress on the anastomosis\n- Strict avoidance of Valsalva\u2011type straining \u2013 increases intra\u2011abdominal pressure on the healing join\n- Defecatory attempts: sit 8\u201310 minutes max with diaphragmatic breathing\n- Exit if no peristaltic urge \u2013 forced attempts offer no benefit",
        didYouKnow:
          "It is clinically common to observe a formed Bristol 4 stool followed by looser Bristol 6 episodes and then a prolonged interval without output. This pattern reflects the interplay between colonic water absorption and luminal osmolality. Under normal conditions, the colon absorbs approximately 1.5 litres of water per day from the faecal stream. When a hypertonic fluid like Aquarius enters the colon, it temporarily reverses this process \u2013 water moves into the lumen rather than out of it. Once the sugar is absorbed or passed, the gradient reverses and the colon begins reabsorbing water normally \u2013 but there is a lag period where transit slows while the colon processes the backlog. BRAT foods supported the solid stool; Aquarius was the sole variable that altered fluid balance.",
      },
    },
  },
  {
    value: "data_deep_dive",
    label: "Data Deep Dive",
    description: "Flat affect, technical analysis with explicit terms and short explanations.",
    Icon: Target,
    // analytical + mixed
    preview: {
      standard: {
        summary:
          "Today\u2019s record shows a sequence of one Bristol type 4 stool, followed by two Bristol type 6 stools and an approximately 16\u2011hour period without output. That pattern is highly consistent with an osmotic effect from Aquarius \u2013 the sugary drink pulling water into the colon \u2013 rather than any problem with your food choices or your surgical join.",
        suggestions:
          "Based on this, the main levers for the next 24 hours are: reduce or pause Aquarius, keep to your low\u2011residue \u201csafe\u201d foods, use wet meals to support gentle transit, and avoid straining so you don\u2019t put unnecessary pressure on the anastomosis (the surgical join between bowel segments).",
        didYouKnow:
          "Seeing Bristol 4 and Bristol 6 in the same day is common after bowel surgery. The difference mainly reflects changes in water content and transit speed, which drinks like Aquarius can shift quickly.",
      },
      concise: {
        summary:
          "- Bristol 4 \u2192 Bristol 6s \u2192 16h gap\n- Cause: Aquarius osmotic load\n- Foods: performing as expected\n- No obstruction signal",
        suggestions: "- Pause osmotic drinks\n- No straining on join\n- Log next output time",
        didYouKnow: "Osmotic gradient drives the stool mix pattern.",
      },
      detailed: {
        summary:
          "Today\u2019s record shows a clear three\u2011phase pattern: one Bristol type 4 stool (formed, good water absorption), followed by two Bristol type 6 stools (excess colonic water), then an approximately 16\u2011hour period without output (colonic recovery phase). This sequence is highly consistent with an osmotic effect from Aquarius rather than any problem with your food choices or surgical join.\n\nThe mechanism: Aquarius is a hypertonic fluid. When it reaches the colon, the high sugar concentration creates an osmotic gradient that pulls water from the blood vessels into the colonic lumen. This increases stool water content, producing Bristol 6s. Once the sugar is absorbed or passed, the gradient reverses and the colon begins reabsorbing water normally \u2013 but there is a lag period. BRAT foods supported the solid stool; Aquarius was the sole variable that altered fluid balance.",
        suggestions:
          "Based on the data, the actionable levers for the next 24 hours are:\n\n- Eliminate Aquarius and similar hypertonic fluids \u2013 they create the osmotic gradient responsible for the Bristol 6 output\n- Replace with plain water or isotonic ORS \u2013 matches your body\u2019s osmolality without pulling extra water into the colon\n- Keep to low\u2011residue safe foods \u2013 minimises mechanical load on the anastomosis\n- Use wet meals to support gentle transit without straining\n- Sit 5\u201310 minutes relaxed with pelvic floor down and open\n- No bearing down \u2013 max 10 min per attempt\n- Log urge, time, and outcome for pattern tracking",
        didYouKnow:
          "Seeing Bristol 4 and Bristol 6 in the same day is common after bowel surgery and is not a sign of deterioration. The difference mainly reflects changes in colonic water content and transit speed. Your colon normally absorbs about 1.5L of water per day from the faecal stream. Hypertonic drinks like Aquarius temporarily reverse this: instead of the colon absorbing water, water floods into the lumen to dilute the sugar. This produces the loose Bristol 6 stools. Once the osmotic agent clears, normal absorption resumes but the colon needs hours to reprocess accumulated contents \u2013 hence the 16\u2011hour gap. This is a predictable, mechanistic response, not a complication.",
      },
    },
  },
  {
    value: "quiet_checkin",
    label: "Quiet Check-In",
    description: "Family\u2011doctor vibe, plain words, close and personal but not a cheerleader.",
    Icon: Moon,
    // personal + everyday
    preview: {
      standard: {
        summary:
          "Hi Peter. Looking at today\u2019s log, that Bristol 4 in the morning is exactly what I\u2019d hope to see from you at this stage \u2013 a proper, formed poo. The two softer ones afterwards and the long 16\u2011hour gap fit with the amount of Aquarius you drank, not with a problem in your diet or your join.",
        suggestions:
          "I\u2019m not worried about you going 14\u201316 hours without a poo as long as you\u2019re not in strong pain, badly bloated, or feeling very unwell. For the next day, keep things simple: gentle, wet meals, and every time you sit down to pee, just relax on the toilet and see if anything wants to come. No straining \u2013 your join is still too new for that.",
        didYouKnow:
          "It\u2019s completely normal to see a really good poo and then a couple of loose ones, and then nothing for a good stretch. That doesn\u2019t mean anything is blocked; it mostly reflects how much water is moving through at different times.",
      },
      concise: {
        summary:
          "- Bristol 4 = proper formed poo\n- Bristol 6s from Aquarius sugar\n- 16h gap = normal gut rest\n- Nothing to worry about",
        suggestions: "- No Aquarius for now\n- Simple, gentle foods\n- Relax on toilet, no pushing",
        didYouKnow: "Good poo + loose ones + quiet stretch = normal recovery day.",
      },
      detailed: {
        summary:
          "Hi Peter. Looking at today\u2019s log, that Bristol 4 in the morning is exactly what I\u2019d hope to see from you at this stage \u2013 a proper, formed poo. It shows your bowel is settling into a good rhythm and learning how to do its job again after surgery. When your colon is working well, it pulls water out of your poo as it passes through, and that\u2019s exactly what happened with that Bristol 4 \u2013 nice and formed.\n\nThe two softer ones afterwards and the long 16\u2011hour gap fit with the amount of Aquarius you drank, not with a problem in your diet or your join. Here\u2019s what happened: the sugar in Aquarius pulled extra water into your gut (like how salt pulls water out of a cucumber). That extra water made your next poos runnier. Then your body needed time to catch up and get back to normal \u2013 that\u2019s the 16\u2011hour quiet stretch. You\u2019re doing well; this is just a small fluid hiccup, not a setback.",
        suggestions:
          "I\u2019m not worried about you going 14\u201316 hours without a poo as long as you\u2019re not in strong pain, badly bloated, or feeling very unwell. Here\u2019s what I\u2019d suggest and why:\n\n- Cut back on Aquarius\u2011style drinks \u2013 the sugar is what pulled the extra water into your gut and made things loose\n- Stick to plain water or broth \u2013 these keep you hydrated without upsetting the water balance in your bowel\n- Eat small and often \u2013 smaller portions are gentler on your healing join\n- Every time you sit down to pee, just relax on the toilet and see if anything wants to come naturally\n- No straining \u2013 your join is still too new for that, and pushing could put pressure on it\n- Try 5\u201310 minutes each time, then stand up if nothing happens\n- Read a book or listen to music to help you relax",
        didYouKnow:
          "It\u2019s completely normal to see a really good poo and then a couple of loose ones, and then nothing for a good stretch. That doesn\u2019t mean anything is blocked. What\u2019s actually happening is that your gut handles water differently at different times of day. When you had that Aquarius, the sugar created what\u2019s called an \u201cosmotic pull\u201d \u2013 imagine the sugar molecules acting like tiny sponges, soaking up water from your bloodstream into your bowel. That extra water made your poo runnier (the Bristol 6s). Once all that sugar passed through, your gut went back to absorbing water normally, but it needed hours to catch up. The BRAT foods helped make that first solid poo; the drink just added a temporary watery twist.",
      },
    },
  },
];

// ── 9x3 preview matrix (approach x register x length) ───────────────────────

export const ADVANCED_PREVIEW_MATRIX: Record<Approach, Record<Register, AdvancedPreviewSet>> = {
  supportive: {
    everyday: {
      heading: "Supportive + Everyday",
      standard: {
        summary:
          "You had a lovely solid Bristol 4 this morning \u2013 your gut is really starting to make proper poos again. That\u2019s a big win. The two softer, splattery poos afterwards plus the long quiet stretch are your body reacting to all that Aquarius, not a sign that you\u2019ve messed anything up with food.",
        suggestions:
          "For the next day, think \u201ckind and slippery\u201d for your belly: gentle, soft foods and wet, soothing meals. When you sit down to pee, just relax and see if anything wants to come out on its own. No pushing, no forcing \u2013 your join is still healing and needs you to be kind to it.",
        didYouKnow:
          "You can have a perfect Bristol 4, then some Bristol 6 poos, and then no poo for a long time \u2013 all in the same day. That happens because drinks like Aquarius drag water into your gut quickly, so you get some runny bits, then everything slows down again.",
      },
      concise: {
        summary:
          "- Bristol 4 this morning \u2013 your gut is forming poos!\n- Softer poos after = Aquarius water pull\n- Long quiet stretch = normal body rest",
        suggestions: "- Gentle wet foods tomorrow\n- Relax on toilet, no pushing",
        didYouKnow: "Good poo + runny + quiet = normal after surgery.",
      },
      detailed: {
        summary:
          "You had a lovely solid Bristol 4 this morning \u2013 your gut is really starting to make proper poos again. That\u2019s a genuinely big win and shows your body is healing beautifully. When your gut is working well, it pulls water out of your poo as it moves through, and that\u2019s exactly what happened \u2013 nice and formed.\n\nThe two softer, splattery poos afterwards plus the long quiet stretch are your body reacting to all that Aquarius, not a sign that you\u2019ve messed anything up with food. Here\u2019s what happened: the sugar in Aquarius pulled extra water into your gut (like how adding sugar to strawberries makes them release juice). That extra water made your poo runnier for a while. Then everything took a break to catch up \u2013 that\u2019s the quiet stretch. This is all normal ups and downs. Your belly is working hard to heal, and you\u2019re doing a great job listening to it.",
        suggestions:
          "For the next day, think \u201ckind and slippery\u201d for your belly. Here\u2019s what to do and why each thing helps:\n\n- Skip sugary drinks like Aquarius \u2013 the sugar is what pulled extra water into your gut and made things runny\n- Sip plain water or clear broth instead \u2013 these hydrate you without upsetting your belly\u2019s water balance\n- Gentle, soft foods and wet, soothing meals \u2013 easy for your healing gut to handle\n- Smaller, more frequent meals \u2013 so your gut isn\u2019t overwhelmed at any one time\n- When you sit on the toilet, just relax and breathe \u2013 no pushing, no forcing\n- Try 5\u201310 minutes of relaxed sitting; if nothing happens, stand up and try later\n- Your join is still healing and needs you to be kind to it",
        didYouKnow:
          "You can have a perfect Bristol 4, then some Bristol 6 poos, and then no poo for a long time \u2013 all in the same day. This happens because of how your gut handles water. Think of your bowel like a sponge: normally it soaks up water from your poo as it passes through. But when you drink something sugary like Aquarius, it\u2019s like squeezing that sponge in reverse \u2013 water floods out into the poo instead. That gives you the runny bits. Once the sugar passes through, the sponge goes back to normal, but it takes a few hours to catch up. Your healing bowel is like a new highway \u2013 sometimes traffic moves fast, sometimes it pauses. The safe foods helped you get that solid poo first thing.",
      },
    },
    mixed: {
      heading: "Supportive + Balanced",
      standard: {
        summary:
          "You nailed a Bristol 4 this morning \u2013 that\u2019s your bowel showing it can form proper, healthy\u2011looking stool now. Amazing progress. The two looser Bristol 6 stools that followed, plus the long 16\u2011hour pause, are almost certainly your Aquarius pulling extra water into the gut, not a sign that your foods are \u201cwrong.\u201d",
        suggestions:
          "For the next 24 hours, think of giving your anastomosis \u2013 the surgical join in your bowel \u2013 a calm, spa\u2011day shift. Keep to your safe, simple foods and choose wet, soothing meals so things can glide without any straining. When you sit to pee, just relax and notice your breath; if something wants to come, it will. No pushing needed.",
        didYouKnow:
          "It\u2019s completely possible to see a solid Bristol 4, then a couple of Bristol 6 stools, then a long pause. That mix happens because water movement in the gut changes very quickly, especially when drinks like Aquarius pull extra fluid into the colon.",
      },
      concise: {
        summary:
          "- Bristol 4 = bowel forming stool well\n- Bristol 6s from Aquarius osmotic pull\n- 16h pause = normal recovery\n- Foods on track",
        suggestions: "- Pause sugary drinks\n- Relaxed toilet sits only, protect anastomosis",
        didYouKnow: "Water shifts cause the 4\u21926\u2192pause pattern.",
      },
      detailed: {
        summary:
          "You nailed a Bristol 4 this morning \u2013 that\u2019s your bowel showing it can form proper, healthy\u2011looking stool now. Amazing progress \u2013 it means your colon is successfully absorbing water from the faecal stream, which is exactly what we want to see.\n\nThe two looser Bristol 6 stools that followed, plus the long 16\u2011hour pause, are almost certainly your Aquarius pulling extra water into the gut through a process called osmosis. The sugar in the drink acts a bit like a mild osmotic laxative \u2013 it draws water across the intestinal wall into the bowel lumen, making your stool runnier. Once that sugar passes through, your colon needs time to reset its water balance, which explains the long quiet period. Your safe foods are doing their job perfectly; this was a drink effect, not a food failure. You\u2019re moving in the right direction.",
        suggestions:
          "For the next 24 hours, think of giving your anastomosis (the surgical join in your bowel) a calm, spa\u2011day shift. Here\u2019s the plan and why each step helps:\n\n- Pause sugary drinks like Aquarius \u2013 they create the osmotic pull that loosened your stool\n- Stick to plain water, herbal tea, or clear broth \u2013 these hydrate without disturbing colonic water balance\n- Eat smaller, softer meals more often \u2013 gentler on the anastomosis\n- When you sit to pee, just relax and notice your breath \u2013 relaxation helps the pelvic floor open naturally\n- No pushing needed \u2013 straining increases pressure on your healing join\n- Set a timer for 5\u20138 minutes of relaxed sitting; stand up if nothing happens",
        didYouKnow:
          "It\u2019s completely possible to see a solid Bristol 4, then a couple of Bristol 6 stools, then a long pause \u2013 all in one day. This happens because colonic water handling can shift very quickly. Your colon normally absorbs about 1.5 litres of water per day from the faecal stream. But when a sugary drink like Aquarius reaches the colon, the sugar creates an osmotic gradient that temporarily reverses this process \u2013 water floods into the bowel instead of being absorbed out of it. This produces the loose Bristol 6 stools. Once the sugar clears, normal absorption resumes, but there\u2019s a recovery lag while the colon catches up. Your BRAT foods helped create that first good stool; the drink just added a watery twist.",
      },
    },
    clinical: {
      heading: "Supportive + Clinical",
      standard: {
        summary:
          "Today\u2019s pattern is actually a sign of progress: an initial Bristol type 4 stool shows good stool formation, which is excellent at two weeks post\u2011surgery. The subsequent Bristol type 6 stools and the prolonged period without output appear to be driven mainly by the osmotic effect of Aquarius rather than any failure of your diet or anastomosis.",
        suggestions:
          "For the next 24 hours, we\u2019ll protect the anastomosis \u2013 the surgical join between your bowel segments \u2013 by favouring low\u2011residue, high\u2011moisture foods and avoiding additional osmotic load. Each time you sit on the toilet, focus on diaphragmatic breathing and keeping the pelvic floor relaxed; avoid Valsalva\u2011type straining, which could increase pressure on the join.",
        didYouKnow:
          "It is entirely possible to see a well\u2011formed Bristol 4, then softer Bristol 6 stools, followed by a long pause. This reflects changes in luminal water content and transit, not necessarily obstruction or failure of the join. Osmotic agents like sugary drinks can cause brief high\u2011water output before things slow again.",
      },
      concise: {
        summary:
          "- Bristol 4 = good formation, progress!\n- Bristol 6s + pause = Aquarius osmotic effect\n- No anastomotic concern",
        suggestions:
          "- Low\u2011residue, high\u2011moisture meals\n- No Valsalva, relax pelvic floor",
        didYouKnow: "Osmotics cause transient high\u2011water output then compensatory pause.",
      },
      detailed: {
        summary:
          "Today\u2019s pattern is actually a sign of progress: an initial Bristol type 4 stool demonstrates effective colonic water absorption, which is excellent at two weeks post\u2011surgery. The colon is successfully extracting water from the faecal stream to produce formed stool \u2013 this indicates the anastomosis is allowing normal bowel physiology to resume.\n\nThe subsequent Bristol type 6 stools and the prolonged period without output appear to be driven mainly by the osmotic effect of Aquarius. When a hypertonic (high\u2011sugar) fluid enters the colon, it creates an osmotic gradient that draws water across the intestinal mucosa into the lumen. This is the same mechanism used therapeutically by osmotic laxatives like lactulose. Once the osmotic load passes, the colon\u2019s normal absorptive function resumes, but there is a recovery period. Your BRAT\u2011type foods are performing as expected; this is a fluid balance issue, not a structural concern.",
        suggestions:
          "For the next 24 hours, we\u2019ll protect the anastomosis by favouring low\u2011residue, high\u2011moisture foods and avoiding additional osmotic load. Here\u2019s the detailed plan:\n\n- Eliminate sugary drinks like Aquarius \u2013 the high sugar content creates the osmotic gradient that loosened stool\n- Replace with plain water, electrolyte solutions, or clear broths \u2013 these provide hydration without osmotic disruption\n- Divide intake into 5\u20136 small, frequent meals \u2013 reduces mechanical stress on the healing join\n- Diaphragmatic breathing on the toilet \u2013 keeps the pelvic floor relaxed\n- Avoid Valsalva\u2011type straining \u2013 increases intra\u2011abdominal pressure on the anastomosis\n- Allow 8\u201310 minutes per session with a footstool if possible\n- Exit if no urge arises \u2013 forced attempts offer no benefit and increase risk",
        didYouKnow:
          "It is entirely possible to see a well\u2011formed Bristol 4, then softer Bristol 6 stools, followed by a long pause. This reflects changes in luminal water content and colonic transit dynamics. Under normal conditions, the colon absorbs approximately 1.5 litres of water per day from the faecal stream through active sodium\u2011linked transport and passive water following. When a hypertonic fluid enters the colon, the osmotic gradient temporarily reverses: water moves into the lumen rather than being absorbed. This produces the high\u2011water Bristol 6 output. Once the osmotic agent is cleared, normal absorption resumes, but the colon needs time to reprocess accumulated contents \u2013 hence the extended pause. This is a physiological recovery, not obstruction.",
      },
    },
  },
  personal: {
    everyday: {
      heading: "Personal + Everyday",
      standard: {
        summary:
          "Hi Peter. Looking at today\u2019s log, that Bristol 4 in the morning is exactly what I\u2019d hope to see from you at this stage \u2013 a proper, formed poo. The two softer ones afterwards and the long 16\u2011hour gap fit with the amount of Aquarius you drank, not with a problem in your diet or your join.",
        suggestions:
          "I\u2019m not worried about you going 14\u201316 hours without a poo as long as you\u2019re not in strong pain, badly bloated, or feeling very unwell. For the next day, keep things simple: gentle, wet meals, and every time you sit down to pee, just relax on the toilet and see if anything wants to come. No straining \u2013 your join is still too new for that.",
        didYouKnow:
          "It\u2019s completely normal to see a really good poo and then a couple of loose ones, and then nothing for a good stretch. That doesn\u2019t mean anything is blocked; it mostly reflects how much water is moving through at different times.",
      },
      concise: {
        summary:
          "- Bristol 4 = proper formed poo\n- Bristol 6s from Aquarius sugar\n- 16h gap = normal gut rest",
        suggestions: "- No Aquarius for now\n- Simple foods, relax on toilet, no push",
        didYouKnow: "Good + loose + quiet = normal recovery day.",
      },
      detailed: {
        summary:
          "Hi Peter. Looking at today\u2019s log, that Bristol 4 in the morning is exactly what I\u2019d hope to see from you at this stage \u2013 a proper, formed poo. It shows your bowel is settling into a good rhythm and learning to do its job again. When your gut is working well, it pulls water out of your poo as it passes through \u2013 and that\u2019s exactly what happened with that Bristol 4.\n\nThe two softer ones afterwards and the long 16\u2011hour gap fit with the amount of Aquarius you drank, not with a problem in your diet or your join. The sugar in it pulled extra water into your gut (like how salt pulls water out of a cucumber). That extra water made your next poos runnier. Then your body needed time to catch up \u2013 that\u2019s the quiet stretch. You\u2019re doing well; this is just a small fluid hiccup, not a setback.",
        suggestions:
          "I\u2019m not worried about you going 14\u201316 hours without a poo as long as you\u2019re not in strong pain, badly bloated, or feeling very unwell. Here\u2019s what I\u2019d suggest and why:\n\n- Cut back on Aquarius\u2011style drinks \u2013 the sugar pulls extra water into your gut\n- Stick to plain water or broth \u2013 hydrates without upsetting your belly\u2019s water balance\n- Eat small and often \u2013 gentler on your healing join\n- Relax on the toilet, no straining \u2013 your join is still too new for pushing\n- Try 5\u201310 minutes each time; read or listen to music\n- Walk around if nothing happens and try later",
        didYouKnow:
          "It\u2019s completely normal to see a really good poo and then a couple of loose ones, and then nothing for a good stretch. That doesn\u2019t mean anything is blocked. What\u2019s happening is that your gut handles water differently at different times. When you had that Aquarius, the sugar created what\u2019s called an \u201cosmotic pull\u201d \u2013 imagine tiny sponges soaking up water from your bloodstream into your bowel. That\u2019s what made the loose poos. Once the sugar passed through, your gut went back to absorbing water normally, but it needed hours to catch up. The BRAT foods helped the solid one; the drink just added a temporary watery twist.",
      },
    },
    mixed: {
      heading: "Personal + Balanced",
      standard: {
        summary:
          "Hi Peter. I\u2019m happy with that Bristol type 4 you had this morning \u2013 that tells me your bowel can form decent stool now. The two Bristol 6 stools after it and the long 16\u2011hour break match up very neatly with the amount of Aquarius you drank; the sugary drink is pulling water into your colon rather than your food \u201cfailing.\u201d",
        suggestions:
          "I\u2019m not concerned about a 14\u201316\u2011hour gap without a poo for you as long as there\u2019s no sharp pain, big bloating, or vomiting. For the next 24 hours, let\u2019s give your anastomosis (the surgical join between your bowel segments) a quiet day: wet, low\u2011residue meals, and absolutely no straining when you\u2019re on the toilet.",
        didYouKnow:
          "It\u2019s very common to see a mix of Bristol 4 and Bristol 6 in the same day, especially when drinks are changing. The difference is mostly about how much water is sitting in the stool at each point, not about sudden damage or healing.",
      },
      concise: {
        summary:
          "- Bristol 4 shows good formation\n- Bristol 6s from Aquarius osmosis\n- Pause = normal recovery",
        suggestions: "- Cut sugary drinks\n- Relaxed sits, no strain on join",
        didYouKnow: "Fluid shifts cause the stool mix pattern.",
      },
      detailed: {
        summary:
          "Hi Peter. I\u2019m happy with that Bristol type 4 you had this morning \u2013 that tells me your bowel can form decent stool now, which is a clear sign things are moving in the right direction. Your colon is successfully absorbing water from the faecal stream to produce formed stool.\n\nThe two Bristol 6 stools after it and the long 16\u2011hour break match up very neatly with the amount of Aquarius you drank. The sugary drink creates what\u2019s called an osmotic gradient \u2013 the sugar pulls water across the intestinal wall into the bowel, making stool runnier. It\u2019s the same mechanism used by osmotic laxatives. Once the sugar passes through, your colon resumes normal absorption, but there\u2019s a recovery lag. Your safe list is solid; adjust the drinks and you should see more steady patterns.",
        suggestions:
          "I\u2019m not concerned about a 14\u201316\u2011hour gap without a poo as long as there\u2019s no sharp pain, big bloating, or vomiting. Here\u2019s the plan:\n\n- Pause sugary drinks like Aquarius \u2013 they create the osmotic pull that loosened your stool\n- Switch to plain fluids or broth \u2013 hydrates without disrupting colonic water balance\n- Small meals every 3 hours \u2013 gentler on the anastomosis\n- Wet, low\u2011residue meals for the next 24 hours\n- 5\u201310 minutes relaxed sitting, pelvic floor down and open\n- Absolutely no bearing down or straining",
        didYouKnow:
          "It\u2019s very common to see Bristol 4 and Bristol 6 in the same day, especially when drinks are changing. The difference is mostly about how much water is sitting in the stool at each point. Your colon normally absorbs about 1.5L of water per day from the faecal stream. When a sugary drink enters the colon, the sugar creates an osmotic gradient that temporarily reverses this \u2013 water floods into the bowel instead of being absorbed out. That\u2019s the Bristol 6. Once the sugar clears, normal absorption resumes but needs hours to catch up \u2013 that\u2019s the pause. BRAT foods supported the solid stool; Aquarius triggered the watery ones.",
      },
    },
    clinical: {
      heading: "Personal + Clinical",
      standard: {
        summary:
          "Hi Peter. From a clinical point of view, today\u2019s pattern is acceptable for your stage: an initial Bristol type 4 stool indicates good formation, while the subsequent Bristol type 6 stools and prolonged absence of further output are most consistent with the osmotic effect of Aquarius, rather than a complication at the anastomosis.",
        suggestions:
          "In your case, a 14\u201316\u2011hour interval without defecation is not worrisome provided there is no significant abdominal pain, progressive distension, or vomiting. Over the next 24 hours, I\u2019d recommend low\u2011residue, high\u2011moisture meals and strict avoidance of straining to protect the anastomotic site.",
        didYouKnow:
          "It is clinically common to observe a formed Bristol 4 stool followed by looser Bristol 6 episodes and then a prolonged interval without output. This pattern typically reflects shifts in luminal water and transit rather than obstruction or anastomotic failure.",
      },
      concise: {
        summary:
          "- Bristol 4 = good colonic formation\n- Bristol 6s + pause = Aquarius osmosis\n- No anastomotic concern",
        suggestions: "- Discontinue Aquarius\n- No straining, protect anastomosis",
        didYouKnow: "Osmotics cause transient loose output then compensatory pause.",
      },
      detailed: {
        summary:
          "Hi Peter. From a clinical perspective, today\u2019s pattern is acceptable and encouraging for your recovery stage. The initial Bristol type 4 stool indicates effective colonic water absorption \u2013 your colon is successfully extracting water from the faecal stream to produce formed stool, which means the anastomosis is allowing normal bowel physiology to resume.\n\nThe subsequent Bristol type 6 stools and prolonged absence of further output are most consistent with the osmotic effect of Aquarius. When a hypertonic fluid reaches the colon, it draws water across the intestinal mucosa by osmosis, increasing stool water content. This is the same mechanism used by osmotic laxatives like lactulose. Once the osmotic load passes, normal absorption resumes with a recovery lag. Your BRAT\u2011type foods clearly supported the formed stool; the drink introduced the water shift. No immediate concerns, but protective measures are prudent.",
        suggestions:
          "A 14\u201316\u2011hour interval without defecation is not worrisome provided there is no significant abdominal pain, progressive distension, or vomiting. Here is a structured plan:\n\n- Discontinue Aquarius immediately \u2013 the high sugar content creates the osmotic gradient\n- Replace with plain water or ORS \u2013 replaces electrolytes without osmotic load\n- Low\u2011residue meals every 3\u20134 hours to reduce mechanical stress on the anastomosis\n- Strict avoidance of straining \u2013 increases intra\u2011abdominal pressure on the healing join\n- Sit for 8\u201310 minutes maximum with diaphragmatic breathing\n- Exit if no peristaltic urge",
        didYouKnow:
          "It is clinically common to observe a formed Bristol 4 stool followed by looser Bristol 6 episodes and then a prolonged interval without output. This pattern reflects the interplay between colonic water absorption and luminal osmolality. Under normal conditions, the colon absorbs approximately 1.5L of water per day from the faecal stream through active sodium transport and passive water following. When a hypertonic fluid enters the colon, the osmotic gradient temporarily reverses: water moves into the lumen rather than being absorbed. This produces the high\u2011water Bristol 6 output. Once the osmotic agent clears, normal absorption resumes, but the colon needs time to reprocess accumulated contents. This is physiological recovery, not obstruction.",
      },
    },
  },
  analytical: {
    everyday: {
      heading: "Analytical + Everyday",
      standard: {
        summary:
          "Your log shows one solid Bristol 4 poo this morning, then two softer Bristol 6 poos, then no poo for about 16 hours. That pattern matches drinking a lot of Aquarius: the drink pulls water into your gut, so you get some runny poo and then a long quiet stretch.",
        suggestions:
          "The data don\u2019t suggest a blockage here; they suggest a fluid effect. For the next day, keep your food simple and wet, ease off the Aquarius\u2011type drinks, and don\u2019t push on the toilet. Your join is two weeks old and doesn\u2019t need extra pressure.",
        didYouKnow:
          "It\u2019s very normal to see \u201ca good poo\u201d and \u201crunny poo\u201d on the same day. The shape depends a lot on how much water is sitting in your gut at each moment, not just on what you ate.",
      },
      concise: {
        summary:
          "- Bristol 4 \u2192 two Bristol 6 \u2192 16h gap\n- Cause: Aquarius water pull\n- Foods: fine\n- No blockage signal",
        suggestions: "- Stop Aquarius\n- No push, relaxed sits\n- Log next output",
        didYouKnow: "Drink sugar shifts gut water \u2192 stool pattern change.",
      },
      detailed: {
        summary:
          "Your log shows a clear three\u2011phase pattern: one solid Bristol 4 poo this morning, then two softer Bristol 6 poos, then no poo for about 16 hours. That pattern matches drinking a lot of Aquarius. Here\u2019s what happened: the sugar in the drink pulled extra water into your gut (like how salt pulls water out of a cucumber). That extra water made your next poos runnier. Then your body needed time to catch up and get back to normal \u2013 that\u2019s the 16\u2011hour quiet stretch.\n\nYour BRAT foods are fine; they supported the solid one. The drink changed the water balance. The gap is not a problem without pain or bloating.",
        suggestions:
          "The data don\u2019t suggest a blockage; they suggest a fluid effect. Here\u2019s the plan and why:\n\n- Stop Aquarius for 24 hours \u2013 the sugar is what pulled extra water into your gut\n- Use plain water or broth instead \u2013 hydrates without upsetting your gut\u2019s water balance\n- Small, wet meals \u2013 easier for your healing join to handle\n- Don\u2019t push on the toilet \u2013 your join is two weeks old and doesn\u2019t need extra pressure\n- Sit 5\u201310 minutes max, relax only\n- Log if anything comes so we can track the pattern",
        didYouKnow:
          "It\u2019s very normal to see a good poo and a runny poo on the same day. The shape depends on how much water is sitting in your gut at each moment, not just on what you ate. Here\u2019s the science in plain terms: your gut normally soaks up water from your poo as it passes through. But when you drink something sugary, the sugar acts like a sponge \u2013 it pulls water from your blood into your bowel instead. That makes the poo runnier. Once the sugar passes through, your gut goes back to soaking up water normally, but it takes hours to catch up. That\u2019s the quiet stretch.",
      },
    },
    mixed: {
      heading: "Analytical + Balanced",
      standard: {
        summary:
          "Today\u2019s record shows a sequence of one Bristol type 4 stool, followed by two Bristol type 6 stools and an approximately 16\u2011hour period without output. That pattern is highly consistent with an osmotic effect from Aquarius \u2013 the sugary drink pulling water into the colon \u2013 rather than any problem with your food choices or your surgical join.",
        suggestions:
          "Based on this, the main levers for the next 24 hours are: reduce or pause Aquarius, keep to your low\u2011residue \u201csafe\u201d foods, use wet meals to support gentle transit, and avoid straining so you don\u2019t put unnecessary pressure on the anastomosis (the surgical join between bowel segments).",
        didYouKnow:
          "Seeing Bristol 4 and Bristol 6 in the same day is common after bowel surgery. The difference mainly reflects changes in water content and transit speed, which drinks like Aquarius can shift quickly.",
      },
      concise: {
        summary:
          "- Bristol 4 \u2192 Bristol 6s \u2192 16h gap\n- Cause: Aquarius osmotic load\n- Foods: performing as expected\n- No obstruction signal",
        suggestions: "- Pause osmotic drinks\n- No straining on join\n- Log next output",
        didYouKnow: "Osmotic gradient drives the stool mix pattern.",
      },
      detailed: {
        summary:
          "Today\u2019s record shows a clear three\u2011phase pattern: one Bristol type 4 stool (formed, good water absorption), followed by two Bristol type 6 stools (excess colonic water), then an approximately 16\u2011hour period without output (colonic recovery phase). This sequence is highly consistent with an osmotic effect from Aquarius rather than any problem with food choices or the surgical join.\n\nThe mechanism: Aquarius is a hypertonic fluid. When it reaches the colon, the high sugar concentration creates an osmotic gradient that pulls water from the blood vessels into the colonic lumen, increasing stool water content and producing Bristol 6s. Once the sugar is absorbed or passed, the gradient reverses and the colon begins reabsorbing water normally \u2013 but there is a lag period. BRAT foods supported the solid stool; Aquarius was the sole variable that altered fluid balance.",
        suggestions:
          "Based on the data, the actionable levers for the next 24 hours are:\n\n- Eliminate Aquarius and similar hypertonic fluids \u2013 they create the osmotic gradient responsible for Bristol 6 output\n- Replace with plain water or isotonic ORS \u2013 matches body osmolality without pulling extra water into the colon\n- Keep to low\u2011residue safe foods \u2013 minimises mechanical load on the anastomosis\n- Use wet meals to support gentle transit\n- Sit 5\u201310 minutes relaxed with pelvic floor down and open\n- No bearing down \u2013 max 10 min per attempt\n- Log urge, time, and outcome for pattern tracking",
        didYouKnow:
          "Seeing Bristol 4 and Bristol 6 in the same day is common after bowel surgery and is not a sign of deterioration. The difference reflects changes in colonic water content and transit speed. Your colon normally absorbs about 1.5L of water per day from the faecal stream. Hypertonic drinks temporarily reverse this: instead of the colon absorbing water, water floods into the lumen to dilute the sugar. This produces loose Bristol 6 stools. Once the osmotic agent clears, normal absorption resumes but the colon needs hours to reprocess accumulated contents \u2013 hence the 16\u2011hour gap. This is a predictable, mechanistic response, not a complication.",
      },
    },
    clinical: {
      heading: "Analytical + Clinical",
      standard: {
        summary:
          "Current logs show a Bristol type 4 bowel movement followed by two Bristol type 6 movements and an approximately 16\u2011hour absence of further output. This pattern is most consistent with increased colonic osmotic load from Aquarius (hypertonic, sugar\u2011containing fluid) and does not, in isolation, indicate obstructive pathology or anastomotic failure.",
        suggestions:
          "Recommended management over the next 24 hours is: discontinue or markedly reduce Aquarius; maintain a low\u2011residue, BRAT\u2011type diet; use high\u2011moisture, low\u2011fibre meals; and avoid Valsalva\u2011type straining to minimise mechanical stress on the anastomosis.",
        didYouKnow:
          "Co\u2011occurrence of formed (Bristol 4) and loose (Bristol 6) stools within the same day is typical when luminal water balance fluctuates, particularly in the presence of osmotic agents. It reflects alterations in transit and fluid handling rather than immediate structural compromise.",
      },
      concise: {
        summary:
          "- Bristol 4 \u2192 Bristol 6s \u2192 16h pause\n- Aquarius osmotic load confirmed\n- No obstructive pathology\n- Foods: performing as expected",
        suggestions: "- Eliminate hypertonic fluids\n- No Valsalva\n- ORS or plain water only",
        didYouKnow: "Osmotics alter colonic transit and fluid handling predictably.",
      },
      detailed: {
        summary:
          "Current logs show a Bristol type 4 bowel movement followed by two Bristol type 6 movements and an approximately 16\u2011hour absence of further output. This three\u2011phase pattern is most consistent with increased colonic osmotic load from Aquarius (hypertonic, sugar\u2011containing fluid) and does not, in isolation, indicate obstructive pathology or anastomotic failure.\n\nThe mechanism: when a hypertonic fluid enters the colon, the elevated luminal osmolality creates a gradient that draws water across the colonic mucosa from the serosal (blood) side to the mucosal (luminal) side. This increases faecal water content, producing Bristol 6 output. Once the osmotic agent is absorbed or passed distally, the gradient reverses and normal colonic water absorption resumes \u2013 but with a compensatory lag period during which transit slows and output ceases. BRAT\u2011type foods supported initial formation; the drink introduced the osmotic shift. The 14\u201316\u2011hour output gap is within expected parameters for this mechanism.",
        suggestions:
          "Recommended management over the next 24 hours:\n\n- Discontinue or markedly reduce Aquarius \u2013 the hypertonic sugar load is the primary osmotic driver\n- Hypertonic fluids: zero intake; hydration via plain water or ORS only\n- Maintain a low\u2011residue, BRAT\u2011type diet with high\u2011moisture, low\u2011fibre meals\n- Meal frequency: 5\u20136 small, low\u2011residue portions to minimise mechanical stress on the anastomosis\n- Defecatory efforts limited to relaxed attempts \u2013 avoid Valsalva\u2011type straining\n- Duration per attempt: 8\u201310 minutes at optimal anorectal angle\n- Exit if no peristaltic urge \u2013 forced attempts offer no benefit and increase intra\u2011abdominal pressure",
        didYouKnow:
          "Co\u2011occurrence of formed (Bristol 4) and loose (Bristol 6) stools within the same day is typical when luminal water balance fluctuates, particularly in the presence of osmotic agents. Under normal physiological conditions, the colon absorbs approximately 1.5 litres of water per day from the faecal stream via active sodium\u2011linked transport and passive osmotic water following. When a hypertonic fluid like Aquarius enters the colon, the elevated luminal osmolality temporarily reverses this process: water moves from the serosa into the lumen rather than being absorbed. This produces the high\u2011volume, high\u2011water Bristol 6 output. Once the osmotic agent is cleared, normal absorptive function resumes, but the colon requires time to reprocess accumulated luminal contents \u2013 this manifests as the extended output\u2011free interval. This is a predictable physiological response to an osmotic challenge, not a structural complication.",
      },
    },
  },
};
