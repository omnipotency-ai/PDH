import type { HealthProfile } from "@/types/domain";

const DEFAULT_CLINICAL_HISTORY = `2019: first colostomy with roughly 20 cm removed from the descending-colon / rectal area.
Later had another colon resection related to scar complications, leaving about 12 cm of distal stump and then lived with a colostomy bag for around 3 years 7 months.
Subsequent reconnective surgery linked the remaining stump back into the colon and diverted small-intestine output through the abdomen with two stomas through the same site.
Recovery included a leak / infection / abdominal collection treated with about 3 months of antibiotics.
Latest anastomosis was on 2026-02-13, reconnecting the colon to the ileum / small intestine and closing the stoma / abdominal wound.
The abdominal wound has now closed and the scab fell off this week.
Smoking: currently 10 to 15 Marlboro Lights per day; previously around 20 per day for about 33 years.
Substance use: crystal meth smoked daily for about 25 years, except for 3 years in prison and 4 sober years from 2014 to 2018.`;

export const DEFAULT_HEALTH_PROFILE: HealthProfile = {
  gender: "",
  ageYears: null,
  surgeryType: "Other",
  surgeryTypeOther: "Ileum-to-colon anastomosis after staged stoma reversal",
  surgeryDate: "2026-02-13",
  height: null,
  startingWeight: null,
  currentWeight: null,
  targetWeight: null,
  clinicalHistory: DEFAULT_CLINICAL_HISTORY,
  comorbidities: [],
  otherConditions: "",
  medications: "",
  supplements: "",
  allergies: "",
  intolerances: "",
  dietaryHistory: "",
  smokingStatus: "",
  smokingCigarettesPerDay: null,
  smokingYears: null,
  alcoholUse: "",
  alcoholAmountPerSession: "",
  alcoholFrequency: "",
  alcoholYearsAtCurrentLevel: null,
  recreationalDrugUse: "",
  recreationalCategories: [],
  recreationalStimulantsFrequency: "",
  recreationalStimulantsYears: null,
  recreationalDepressantsFrequency: "",
  recreationalDepressantsYears: null,
  lifestyleNotes: "",
};
