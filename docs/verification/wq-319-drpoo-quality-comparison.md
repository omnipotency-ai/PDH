# WQ-319: Dr. Poo Quality Comparison -- OLD vs NEW Context Format

**Status:** PREP ONLY -- awaiting user sign-off before verification testing
**Related:** WQ-311 (context compiler refactor)

---

## Summary of Changes

WQ-311 refactored the context compiler from a flat, brute-force log dump into a structured payload with separate semantic sections. This document compares what Dr. Poo receives in each format across representative scenarios to verify nothing important is lost.

### Key structural changes

| Aspect              | OLD                                                                               | NEW                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context builder** | `buildLogContext(logs)` -- single 72h window for ALL log types                    | `buildRecentEvents(logs, profile)` -- variable windows per log type                                                                        |
| **User message**    | `buildUserMessage(foodLogs, bowelEvents, habitLogs, ...)` -- 15 positional params | `buildUserMessage(params)` -- single params object                                                                                         |
| **Time windows**    | 72h fixed for everything                                                          | Food: 48-96h (by surgery + slow-transit modifiers); BM: 48h; Habits/fluids/activities: 24h                                                 |
| **Food trials**     | All 50 (sorted by recency, full detail), under `foodTrialDatabase`                | Curated subsets under `foodContext`: active (max 10), safe (max 10), flags (max 5), stillInTransit, nextToTry                              |
| **Patient context** | `daysPostOp` as a top-level field                                                 | `patient` snapshot object with surgeryType, daysSinceReversal, baselineTransitMinutes, medications, currentBristolTrend, foodTrialCounts   |
| **Delta signals**   | Not present                                                                       | `deltas` object: bristolChangeFromYesterday, recentCulpritExposure, habitStreaks, newFoodsThisWeek                                         |
| **Payload nesting** | Flat: `foodLogs`, `bowelEvents`, `habitLogs` at root                              | Nested: `recentEvents.foodsEaten`, `recentEvents.bowelMovements`, `recentEvents.habits`                                                    |
| **Kept unchanged**  | --                                                                                | weeklyTrends, previousWeekRecap, partialDayContext, patientMessages, baselineComparison, habitCorrelationInsights, recentSuggestionHistory |

---

## Scenario 1: Post-BM Analysis with Mixed Foods (Active User, Day 45)

A user 45 days post-ileostomy-reversal who has logged several meals and a Bristol 6 bowel movement. They have 30 food trials with a mix of statuses.

### OLD format (abridged)

```json
{
  "currentTime": "Wednesday, March 19, 14:30",
  "partialDayContext": {
    "reportGeneratedAt": "Wednesday, 14:30",
    "timeSinceLastBowelMovement": "2 hours",
    "foodsCurrentlyInTransit": [
      "Toast, Butter (eaten 8h ago)",
      "Chicken soup (eaten 14h ago)"
    ]
  },
  "daysPostOp": 45,
  "update": "Here are my latest logs since we last spoke.",
  "foodLogs": [
    {
      "timestamp": 1742000000000,
      "time": "Tue, Mar 18, 08:15",
      "items": [
        {
          "name": "Toast",
          "canonicalName": "toast",
          "quantity": 2,
          "unit": "slices"
        },
        {
          "name": "Butter",
          "canonicalName": "butter",
          "quantity": 1,
          "unit": "pat"
        }
      ]
    },
    {
      "timestamp": 1742020000000,
      "time": "Tue, Mar 18, 13:45",
      "items": [
        {
          "name": "Chicken soup",
          "canonicalName": "chicken_soup",
          "quantity": 1,
          "unit": "bowl"
        }
      ]
    },
    {
      "timestamp": 1742050000000,
      "time": "Wed, Mar 19, 06:30",
      "items": [
        {
          "name": "Porridge",
          "canonicalName": "porridge_oats",
          "quantity": 1,
          "unit": "bowl"
        }
      ]
    }
  ],
  "bowelEvents": [
    {
      "timestamp": 1742060000000,
      "time": "Wed, Mar 19, 12:30",
      "bristolCode": 6,
      "consistency": "mushy",
      "urgency": "urgent",
      "effort": "easy",
      "volume": "large",
      "accident": false,
      "episodes": 1,
      "notes": "came on suddenly"
    }
  ],
  "habitLogs": [
    {
      "timestamp": 1741990000000,
      "time": "Mon, Mar 17, 20:00",
      "habitId": "coffee",
      "name": "Coffee",
      "habitType": "count",
      "quantity": 3
    },
    {
      "timestamp": 1742040000000,
      "time": "Tue, Mar 18, 22:00",
      "habitId": "coffee",
      "name": "Coffee",
      "habitType": "count",
      "quantity": 2
    }
  ],
  "fluidLogs": [
    {
      "timestamp": 1741980000000,
      "time": "Mon, Mar 17, 18:00",
      "name": "water",
      "amountMl": 500
    },
    {
      "timestamp": 1742030000000,
      "time": "Tue, Mar 18, 16:00",
      "name": "water",
      "amountMl": 750
    }
  ],
  "foodTrialDatabase": [
    {
      "name": "Toast",
      "canonicalName": "toast",
      "primaryStatus": "safe",
      "tendency": "safe",
      "confidence": 0.85,
      "totalTrials": 12,
      "culpritCount": 1,
      "safeCount": 11,
      "latestReasoning": "Consistently well tolerated",
      "lastAssessedAt": "Wed, Mar 19, 06:30",
      "recentSuspect": false,
      "clearedHistory": false,
      "learnedTransitCenterMinutes": 720,
      "learnedTransitSpreadMinutes": 120
    },
    {
      "name": "Butter",
      "canonicalName": "butter",
      "primaryStatus": "testing",
      "tendency": "neutral",
      "confidence": 0.3,
      "totalTrials": 3,
      "culpritCount": 1,
      "safeCount": 2,
      "latestReasoning": "Inconclusive so far",
      "lastAssessedAt": "Wed, Mar 19, 06:30",
      "recentSuspect": false,
      "clearedHistory": false,
      "learnedTransitCenterMinutes": 0,
      "learnedTransitSpreadMinutes": 0
    },
    {
      "name": "Spicy Curry",
      "canonicalName": "curry_spicy",
      "primaryStatus": "watch",
      "tendency": "culprit",
      "confidence": 0.7,
      "totalTrials": 5,
      "culpritCount": 3,
      "safeCount": 2,
      "latestReasoning": "Triggered loose stool 3 of 5 times",
      "lastAssessedAt": "Mon, Mar 17, 19:00",
      "recentSuspect": true,
      "clearedHistory": false,
      "learnedTransitCenterMinutes": 480,
      "learnedTransitSpreadMinutes": 60
    },
    "... (27 more food trials, all 30 included)"
  ],
  "weeklyTrends": [
    {
      "weekStart": "2026-03-03",
      "avgBristolScore": 5.8,
      "totalBowelEvents": 18,
      "accidentCount": 2,
      "uniqueFoodsEaten": 8,
      "newFoodsTried": 2,
      "foodsCleared": 1,
      "foodsFlagged": 1
    },
    {
      "weekStart": "2026-03-10",
      "avgBristolScore": 5.1,
      "totalBowelEvents": 15,
      "accidentCount": 0,
      "uniqueFoodsEaten": 10,
      "newFoodsTried": 3,
      "foodsCleared": 2,
      "foodsFlagged": 0
    }
  ],
  "baselineComparison": {
    "digestionBaseline": "avg BM/day: 3.2 | avg Bristol: 5.4"
  }
}
```

### NEW format (abridged)

```json
{
  "currentTime": "Wednesday, March 19, 14:30",
  "partialDayContext": {
    "reportGeneratedAt": "Wednesday, 14:30",
    "timeSinceLastBowelMovement": "2 hours",
    "foodsCurrentlyInTransit": [
      "Toast, Butter (eaten 8h ago)",
      "Chicken soup (eaten 14h ago)"
    ]
  },
  "patient": {
    "daysSinceReversal": 45,
    "surgeryType": "Ileostomy reversal",
    "baselineTransitMinutes": 2880,
    "currentBristolTrend": "improving (5.8 -> 5.1 weekly avg)",
    "foodTrialCounts": {
      "safe": 15,
      "testing": 8,
      "building": 4,
      "watch": 2,
      "avoid": 1
    }
  },
  "update": "Here are my latest logs since we last spoke.",
  "recentEvents": {
    "bowelMovements": [
      {
        "timestamp": 1742060000000,
        "time": "Wed, Mar 19, 12:30",
        "bristolCode": 6,
        "consistency": "mushy",
        "urgency": "urgent",
        "effort": "easy",
        "volume": "large",
        "accident": false,
        "episodes": 1,
        "notes": "came on suddenly"
      }
    ],
    "foodsEaten": [
      {
        "timestamp": 1742000000000,
        "time": "Tue, Mar 18, 08:15",
        "items": [
          {
            "name": "Toast",
            "canonicalName": "toast",
            "quantity": 2,
            "unit": "slices"
          },
          {
            "name": "Butter",
            "canonicalName": "butter",
            "quantity": 1,
            "unit": "pat"
          }
        ]
      },
      {
        "timestamp": 1742020000000,
        "time": "Tue, Mar 18, 13:45",
        "items": [
          {
            "name": "Chicken soup",
            "canonicalName": "chicken_soup",
            "quantity": 1,
            "unit": "bowl"
          }
        ]
      },
      {
        "timestamp": 1742050000000,
        "time": "Wed, Mar 19, 06:30",
        "items": [
          {
            "name": "Porridge",
            "canonicalName": "porridge_oats",
            "quantity": 1,
            "unit": "bowl"
          }
        ]
      }
    ]
  },
  "deltas": {
    "newFoodsThisWeek": [],
    "bristolChangeFromYesterday": null,
    "recentCulpritExposure": null,
    "habitStreaks": { "Coffee": 2 }
  },
  "foodContext": {
    "activeFoodTrials": [
      {
        "food": "Butter",
        "canonicalName": "butter",
        "status": "testing",
        "exposures": 3,
        "tendency": "neutral",
        "confidence": 0.3
      },
      {
        "food": "Chicken Soup",
        "canonicalName": "chicken_soup",
        "status": "building",
        "exposures": 6,
        "tendency": "safe",
        "confidence": 0.6
      }
    ],
    "recentSafe": ["Toast", "White Rice", "Banana", "Potato", "Porridge"],
    "recentFlags": [
      {
        "food": "Spicy Curry",
        "status": "watch",
        "latestReasoning": "Triggered loose stool 3 of 5 times"
      }
    ],
    "nextToTry": "Scrambled Eggs"
  },
  "weeklyTrends": [
    {
      "weekStart": "2026-03-03",
      "avgBristolScore": 5.8,
      "totalBowelEvents": 18,
      "accidentCount": 2,
      "uniqueFoodsEaten": 8,
      "newFoodsTried": 2,
      "foodsCleared": 1,
      "foodsFlagged": 1
    },
    {
      "weekStart": "2026-03-10",
      "avgBristolScore": 5.1,
      "totalBowelEvents": 15,
      "accidentCount": 0,
      "uniqueFoodsEaten": 10,
      "newFoodsTried": 3,
      "foodsCleared": 2,
      "foodsFlagged": 0
    }
  ],
  "baselineComparison": {
    "digestionBaseline": "avg BM/day: 3.2 | avg Bristol: 5.4"
  }
}
```

### What Dr. Poo gains

- **Patient snapshot**: Surgery type, days post-op, baseline transit time, and Bristol trend are now a pre-computed summary. Dr. Poo doesn't have to infer these from raw data.
- **Delta signals**: Explicit `bristolChangeFromYesterday`, `recentCulpritExposure`, and `habitStreaks` mean Dr. Poo can immediately reference quantified changes instead of computing them from log arrays.
- **Curated food context**: Active trials include structured fields (`exposures`, `tendency`, `confidence`) making it easier to reason about trial status. `recentFlags` includes `latestReasoning` for watch/avoid foods.
- **48h food window** (ileostomy reversal): Tighter window for shorter-colon patients means less irrelevant older food data.

### What Dr. Poo loses

- **Habit/fluid logs from 25-72h ago**: OLD included these in the 72h window; NEW limits to 24h. However, `baselineComparison` still captures habit and fluid deltas from the full baseline period.
- **27 of 30 food trials**: Only ~13 are sent (10 active + safe/flag subsets). Foods in "graduated" or "dormant" status are not sent. See risk analysis in [Section: Risk Assessment](#risk-assessment-information-loss-scenarios) below.
- **Individual food trial fields**: OLD included `recentSuspect`, `clearedHistory`, `learnedTransitCenterMinutes`, `learnedTransitSpreadMinutes`, `totalTrials`, `culpritCount`, `safeCount` for every trial. NEW active trials only include `exposures`, `tendency`, `confidence`, `status`, `canonicalName`. Safe foods are reduced to display names only. Flagged foods include `latestReasoning` but not counts.

### Net assessment: ACCEPTABLE

The habit/fluid window reduction is mitigated by `baselineComparison` deltas. The food trial reduction is intentional -- sending 50 trials with full detail was consuming tokens without improving quality, and the curated approach gives Dr. Poo the most actionable subset.

---

## Scenario 2: New User First Check-in (Day 7, Sparse Data)

A brand new user, 7 days post-colostomy-reversal, with only 4 food logs, 2 BMs, and no food trials yet.

### OLD format (abridged)

```json
{
  "currentTime": "Wednesday, March 19, 09:00",
  "partialDayContext": {
    "reportGeneratedAt": "Wednesday, 09:00",
    "partialDayNote": "It is early in the day -- bowel movement data may be incomplete.",
    "timeSinceLastBowelMovement": "14 hours"
  },
  "daysPostOp": 7,
  "update": "Hey Dr. Poo, first check-in -- here are my logs from the last 72 hours. Give me the full picture.",
  "foodLogs": [
    {
      "timestamp": 1741950000000,
      "time": "Mon, Mar 17, 12:00",
      "items": [
        {
          "name": "Plain rice",
          "canonicalName": "white_rice",
          "quantity": 1,
          "unit": "cup"
        }
      ]
    },
    {
      "timestamp": 1741980000000,
      "time": "Mon, Mar 17, 18:00",
      "items": [
        {
          "name": "Toast",
          "canonicalName": "toast",
          "quantity": 2,
          "unit": "slices"
        }
      ]
    },
    {
      "timestamp": 1742020000000,
      "time": "Tue, Mar 18, 08:00",
      "items": [
        {
          "name": "Banana",
          "canonicalName": "banana",
          "quantity": 1,
          "unit": null
        }
      ]
    },
    {
      "timestamp": 1742050000000,
      "time": "Tue, Mar 18, 18:00",
      "items": [
        {
          "name": "Chicken broth",
          "canonicalName": "chicken_broth",
          "quantity": 1,
          "unit": "bowl"
        }
      ]
    }
  ],
  "bowelEvents": [
    {
      "timestamp": 1741970000000,
      "time": "Mon, Mar 17, 16:00",
      "bristolCode": 5,
      "consistency": "soft",
      "urgency": "normal",
      "effort": "easy",
      "volume": "small",
      "accident": false,
      "episodes": 1,
      "notes": ""
    },
    {
      "timestamp": 1742040000000,
      "time": "Tue, Mar 18, 15:00",
      "bristolCode": 6,
      "consistency": "mushy",
      "urgency": "urgent",
      "effort": "easy",
      "volume": "normal",
      "accident": false,
      "episodes": 2,
      "notes": ""
    }
  ],
  "foodTrialDatabase": []
}
```

### NEW format (abridged)

```json
{
  "currentTime": "Wednesday, March 19, 09:00",
  "partialDayContext": {
    "reportGeneratedAt": "Wednesday, 09:00",
    "partialDayNote": "It is early in the day -- bowel movement data may be incomplete.",
    "timeSinceLastBowelMovement": "14 hours"
  },
  "patient": {
    "daysSinceReversal": 7,
    "surgeryType": "Colostomy reversal",
    "baselineTransitMinutes": 4320,
    "currentBristolTrend": "insufficient data"
  },
  "update": "Hey Dr. Poo, first check-in -- here are my recent logs. Give me the full picture.",
  "recentEvents": {
    "bowelMovements": [
      {
        "timestamp": 1742040000000,
        "time": "Tue, Mar 18, 15:00",
        "bristolCode": 6,
        "consistency": "mushy",
        "urgency": "urgent",
        "effort": "easy",
        "volume": "normal",
        "accident": false,
        "episodes": 2,
        "notes": ""
      }
    ],
    "foodsEaten": [
      {
        "timestamp": 1741950000000,
        "time": "Mon, Mar 17, 12:00",
        "items": [
          {
            "name": "Plain rice",
            "canonicalName": "white_rice",
            "quantity": 1,
            "unit": "cup"
          }
        ]
      },
      {
        "timestamp": 1741980000000,
        "time": "Mon, Mar 17, 18:00",
        "items": [
          {
            "name": "Toast",
            "canonicalName": "toast",
            "quantity": 2,
            "unit": "slices"
          }
        ]
      },
      {
        "timestamp": 1742020000000,
        "time": "Tue, Mar 18, 08:00",
        "items": [
          {
            "name": "Banana",
            "canonicalName": "banana",
            "quantity": 1,
            "unit": null
          }
        ]
      },
      {
        "timestamp": 1742050000000,
        "time": "Tue, Mar 18, 18:00",
        "items": [
          {
            "name": "Chicken broth",
            "canonicalName": "chicken_broth",
            "quantity": 1,
            "unit": "bowl"
          }
        ]
      }
    ]
  },
  "deltas": {
    "newFoodsThisWeek": [],
    "bristolChangeFromYesterday": null,
    "recentCulpritExposure": null,
    "habitStreaks": {}
  },
  "foodContext": {
    "activeFoodTrials": [],
    "recentSafe": [],
    "recentFlags": []
  },
  "patientMessages": "NONE -- the patient has NOT sent any new messages. Set directResponseToUser to null."
}
```

### What Dr. Poo gains

- **Patient snapshot**: `daysSinceReversal: 7` and `surgeryType: "Colostomy reversal"` are immediate context. The `baselineTransitMinutes: 4320` (72h) gives Dr. Poo explicit transit expectations.
- **Bristol trend**: Explicitly says `"insufficient data"` -- Dr. Poo knows not to speculate about trends.
- **Empty deltas**: Explicit nulls/empty objects prevent Dr. Poo from hallucinating changes.

### What Dr. Poo loses

- **The older BM**: The Bristol 5 BM from Mon 16:00 (which is ~41h old) IS still within the 48h BM window, so it IS included. No loss here.
- **Nothing material**: With 0 food trials, no habits, and sparse logs, both formats are essentially equivalent.

### Net assessment: NO LOSS

The new format is strictly better for this scenario. The patient snapshot provides structure that helps Dr. Poo give appropriate early-recovery guidance.

---

## Scenario 3: Culprit Exposure with Worsening Bristol (Established User, Day 90)

An established user who ate a known "watch" food (spicy curry) yesterday and is now seeing Bristol 6-7 BMs. They have 40+ food trials.

### OLD format (abridged)

```json
{
  "currentTime": "Wednesday, March 19, 16:00",
  "partialDayContext": {
    "reportGeneratedAt": "Wednesday, 16:00",
    "timeSinceLastBowelMovement": "1 hours",
    "foodsCurrentlyInTransit": ["Spicy curry, Naan bread (eaten 18h ago)"]
  },
  "daysPostOp": 90,
  "update": "Here are my latest logs since we last spoke.",
  "foodLogs": [
    {
      "timestamp": 1742000000000,
      "time": "Tue, Mar 18, 22:00",
      "items": [
        {
          "name": "Spicy curry",
          "canonicalName": "curry_spicy",
          "quantity": 1,
          "unit": "portion"
        },
        {
          "name": "Naan bread",
          "canonicalName": "naan_bread",
          "quantity": 1,
          "unit": "piece"
        }
      ]
    },
    {
      "timestamp": 1742040000000,
      "time": "Wed, Mar 19, 07:00",
      "items": [
        {
          "name": "Toast",
          "canonicalName": "toast",
          "quantity": 1,
          "unit": "slice"
        }
      ]
    }
  ],
  "bowelEvents": [
    {
      "timestamp": 1742050000000,
      "time": "Wed, Mar 19, 10:00",
      "bristolCode": 7,
      "consistency": "watery",
      "urgency": "urgent",
      "effort": "easy",
      "volume": "large",
      "accident": false,
      "episodes": 1,
      "notes": "burning"
    },
    {
      "timestamp": 1742060000000,
      "time": "Wed, Mar 19, 15:00",
      "bristolCode": 6,
      "consistency": "mushy",
      "urgency": "urgent",
      "effort": "easy",
      "volume": "normal",
      "accident": false,
      "episodes": 1,
      "notes": ""
    }
  ],
  "habitLogs": [
    {
      "timestamp": 1741980000000,
      "time": "Mon, Mar 17, 20:00",
      "habitId": "cigarettes",
      "name": "Cigarettes",
      "habitType": "count",
      "quantity": 5
    },
    {
      "timestamp": 1742010000000,
      "time": "Tue, Mar 18, 10:00",
      "habitId": "cigarettes",
      "name": "Cigarettes",
      "habitType": "count",
      "quantity": 4
    }
  ],
  "fluidLogs": [
    {
      "timestamp": 1741970000000,
      "time": "Mon, Mar 17, 16:00",
      "name": "water",
      "amountMl": 500
    },
    {
      "timestamp": 1742030000000,
      "time": "Tue, Mar 18, 20:00",
      "name": "coffee",
      "amountMl": 250
    }
  ],
  "foodTrialDatabase": [
    {
      "name": "Spicy Curry",
      "canonicalName": "curry_spicy",
      "primaryStatus": "watch",
      "tendency": "culprit",
      "confidence": 0.7,
      "totalTrials": 5,
      "culpritCount": 3,
      "safeCount": 2,
      "latestReasoning": "Triggered loose stool 3 of 5 times",
      "lastAssessedAt": "Wed, Mar 19, 10:00",
      "recentSuspect": true,
      "clearedHistory": false,
      "learnedTransitCenterMinutes": 480,
      "learnedTransitSpreadMinutes": 60
    },
    {
      "name": "Naan Bread",
      "canonicalName": "naan_bread",
      "primaryStatus": "testing",
      "tendency": "neutral",
      "confidence": 0.4,
      "totalTrials": 3,
      "culpritCount": 1,
      "safeCount": 2,
      "latestReasoning": "Mixed results, may be confounded",
      "lastAssessedAt": "Wed, Mar 19, 10:00",
      "recentSuspect": false,
      "clearedHistory": false,
      "learnedTransitCenterMinutes": 0,
      "learnedTransitSpreadMinutes": 0
    },
    "... (38 more food trials -- all 40 included)"
  ],
  "weeklyTrends": ["..."],
  "baselineComparison": {
    "digestionBaseline": "avg BM/day: 2.5 | avg Bristol: 4.8"
  }
}
```

### NEW format (abridged)

```json
{
  "currentTime": "Wednesday, March 19, 16:00",
  "partialDayContext": {
    "reportGeneratedAt": "Wednesday, 16:00",
    "timeSinceLastBowelMovement": "1 hours",
    "foodsCurrentlyInTransit": ["Spicy curry, Naan bread (eaten 18h ago)"]
  },
  "patient": {
    "daysSinceReversal": 90,
    "surgeryType": "Colostomy reversal",
    "baselineTransitMinutes": 4320,
    "currentBristolTrend": "worsening (4.5 -> 5.2 -> 5.8 weekly avg)",
    "foodTrialCounts": {
      "safe": 20,
      "testing": 8,
      "building": 5,
      "watch": 4,
      "avoid": 2,
      "graduated": 1
    }
  },
  "update": "Here are my latest logs since we last spoke.",
  "recentEvents": {
    "bowelMovements": [
      {
        "timestamp": 1742050000000,
        "time": "Wed, Mar 19, 10:00",
        "bristolCode": 7,
        "consistency": "watery",
        "urgency": "urgent",
        "effort": "easy",
        "volume": "large",
        "accident": false,
        "episodes": 1,
        "notes": "burning"
      },
      {
        "timestamp": 1742060000000,
        "time": "Wed, Mar 19, 15:00",
        "bristolCode": 6,
        "consistency": "mushy",
        "urgency": "urgent",
        "effort": "easy",
        "volume": "normal",
        "accident": false,
        "episodes": 1,
        "notes": ""
      }
    ],
    "foodsEaten": [
      {
        "timestamp": 1742000000000,
        "time": "Tue, Mar 18, 22:00",
        "items": [
          {
            "name": "Spicy curry",
            "canonicalName": "curry_spicy",
            "quantity": 1,
            "unit": "portion"
          },
          {
            "name": "Naan bread",
            "canonicalName": "naan_bread",
            "quantity": 1,
            "unit": "piece"
          }
        ]
      },
      {
        "timestamp": 1742040000000,
        "time": "Wed, Mar 19, 07:00",
        "items": [
          {
            "name": "Toast",
            "canonicalName": "toast",
            "quantity": 1,
            "unit": "slice"
          }
        ]
      }
    ],
    "habits": [
      {
        "timestamp": 1742010000000,
        "time": "Tue, Mar 18, 10:00",
        "habitId": "cigarettes",
        "name": "Cigarettes",
        "habitType": "count",
        "quantity": 4
      }
    ]
  },
  "deltas": {
    "newFoodsThisWeek": [],
    "bristolChangeFromYesterday": 2.5,
    "recentCulpritExposure": "Spicy Curry",
    "habitStreaks": { "Cigarettes": 3 }
  },
  "foodContext": {
    "activeFoodTrials": [
      {
        "food": "Naan Bread",
        "canonicalName": "naan_bread",
        "status": "testing",
        "exposures": 3,
        "tendency": "neutral",
        "confidence": 0.4
      },
      {
        "food": "Scrambled Eggs",
        "canonicalName": "scrambled_eggs",
        "status": "testing",
        "exposures": 2,
        "tendency": "neutral",
        "confidence": 0.2
      },
      {
        "food": "Pasta",
        "canonicalName": "pasta",
        "status": "building",
        "exposures": 6,
        "tendency": "safe",
        "confidence": 0.65
      }
    ],
    "recentSafe": [
      "Toast",
      "White Rice",
      "Banana",
      "Potato",
      "Chicken Breast",
      "Porridge",
      "Scrambled Eggs (plain)",
      "Applesauce",
      "Sweet Potato",
      "Yoghurt"
    ],
    "recentFlags": [
      {
        "food": "Spicy Curry",
        "status": "watch",
        "latestReasoning": "Triggered loose stool 3 of 5 times"
      },
      {
        "food": "Raw Salad",
        "status": "avoid",
        "latestReasoning": "Caused severe cramps and Bristol 7 twice"
      },
      {
        "food": "Fried Food",
        "status": "watch",
        "latestReasoning": "High fat load correlated with loose output"
      }
    ],
    "nextToTry": "Pasta"
  },
  "weeklyTrends": ["..."],
  "baselineComparison": {
    "digestionBaseline": "avg BM/day: 2.5 | avg Bristol: 4.8"
  }
}
```

### What Dr. Poo gains

- **Immediate culprit signal**: `deltas.recentCulpritExposure: "Spicy Curry"` tells Dr. Poo directly that a watch-status food was eaten in the last 24h. In the OLD format, Dr. Poo would have to cross-reference `foodLogs` against `foodTrialDatabase` to discover this.
- **Bristol change**: `deltas.bristolChangeFromYesterday: 2.5` gives Dr. Poo a precise worsening signal. No need to compute from raw BM logs.
- **Bristol trend**: `patient.currentBristolTrend: "worsening"` provides multi-week context immediately.
- **Food trial counts**: Summary counts (20 safe, 4 watch, 2 avoid) give overall portfolio context without sending all 40 trials.

### What Dr. Poo loses

- **Habit log from Mon 20:00** (44h ago): The cigarette log from Monday is outside the 24h window and excluded from `recentEvents`. However, `deltas.habitStreaks.Cigarettes: 3` captures the fact that this is a multi-day smoking pattern.
- **Fluid log from Mon 16:00** (48h ago): Excluded from 24h window. The `baselineComparison` fluid deltas capture overall hydration trends.
- **Detailed trial data for 37 of 40 foods**: The OLD format sends `totalTrials`, `culpritCount`, `safeCount`, `recentSuspect`, `clearedHistory`, and learned transit times for ALL trials. The NEW format only sends detailed data for active trials (testing/building) and reasoning for flagged foods. Safe foods are just names.
- **Spicy Curry's detailed trial data**: In OLD, Dr. Poo sees `totalTrials: 5, culpritCount: 3, safeCount: 2, learnedTransitCenterMinutes: 480`. In NEW, Dr. Poo sees `latestReasoning: "Triggered loose stool 3 of 5 times"` (which embeds the key stats) plus the `recentCulpritExposure` delta signal.

### Net assessment: ACCEPTABLE WITH CAVEATS

The loss of individual trial counts for watch foods is partially mitigated by including `latestReasoning`. The explicit delta signals (`bristolChangeFromYesterday`, `recentCulpritExposure`) add high-value context that the old format lacked entirely.

**Caveat**: If Dr. Poo needs to recommend whether to "give curry one more chance" vs "move to avoid," the old format's `totalTrials`, `culpritCount`, `safeCount` for the curry trial gave more precise data. The new format relies on `latestReasoning` having been written to include those counts. This is a minor risk -- see risk assessment below.

---

## Scenario 4: Slow Transit Patient (Pregnant, Opioid Medications, Day 60)

A user with multiple slow-transit modifiers: pregnant + on opioid pain medication. Food window expands to 96h.

### OLD format (key differences)

```json
{
  "daysPostOp": 60,
  "foodLogs": [
    "... all food logs from the last 72h (fixed window -- MISSES food from 73-96h ago)"
  ],
  "habitLogs": ["... all habit logs from the last 72h"],
  "fluidLogs": ["... all fluid logs from the last 72h"]
}
```

### NEW format (key differences)

```json
{
  "patient": {
    "daysSinceReversal": 60,
    "surgeryType": "Colostomy reversal",
    "medications": ["codeine (opioid)", "iron supplements"],
    "baselineTransitMinutes": 5760,
    "currentBristolTrend": "firming (5.5 -> 5.0 -> 4.8 weekly avg)"
  },
  "recentEvents": {
    "foodsEaten": [
      "... all food logs from the last 96h (variable window accounts for slow transit)"
    ],
    "habits": ["... habit logs from last 24h only"],
    "fluids": ["... fluid logs from last 24h only"]
  }
}
```

### What Dr. Poo gains

- **Wider food window for slow transit**: The old format used a flat 72h window for all users. A food eaten 80h ago that is still in transit (because opioids slow gut motility) would be MISSED by the old format but INCLUDED by the new 96h window.
- **Explicit medications in patient snapshot**: Dr. Poo can see `medications: ["codeine (opioid)", "iron supplements"]` at a glance.
- **Transit time expectation**: `baselineTransitMinutes: 5760` (96h) tells Dr. Poo the expected transit is slower than typical.

### What Dr. Poo loses

- **Habit/fluid logs from 25-72h**: These are no longer in `recentEvents`, but were available in the old 72h window.

### Net assessment: NET POSITIVE

This is the scenario where the new format is clearly superior. The old format's fixed 72h window was demonstrably wrong for slow-transit patients -- foods that could still be causing GI effects at 80-96h were simply invisible. The variable window fixes a real clinical gap.

---

## Scenario 5: Conversation-Mode Follow-up (Mid-conversation Question)

A user asks Dr. Poo "What about the eggs I had yesterday -- could they be causing this?" during a conversation.

### OLD format

```json
{
  "patientMessages": [
    {
      "message": "What about the eggs I had yesterday -- could they be causing this?",
      "sentAt": "Wed, Mar 19, 14:35"
    }
  ],
  "foodLogs": ["... includes eggs from yesterday if within 72h"],
  "foodTrialDatabase": [
    {
      "name": "Scrambled Eggs",
      "canonicalName": "scrambled_eggs",
      "primaryStatus": "testing",
      "totalTrials": 2,
      "culpritCount": 0,
      "safeCount": 1,
      "latestReasoning": "Well tolerated once, inconclusive",
      "...": "..."
    },
    "... (all 50 trials)"
  ]
}
```

### NEW format

```json
{
  "patientMessages": [
    {
      "message": "What about the eggs I had yesterday -- could they be causing this?",
      "sentAt": "Wed, Mar 19, 14:35"
    }
  ],
  "recentEvents": {
    "foodsEaten": ["... includes eggs from yesterday (within food window)"]
  },
  "foodContext": {
    "activeFoodTrials": [
      {
        "food": "Scrambled Eggs",
        "canonicalName": "scrambled_eggs",
        "status": "testing",
        "exposures": 2,
        "tendency": "neutral",
        "confidence": 0.2
      }
    ]
  }
}
```

### What Dr. Poo gains

- The eggs trial is in `activeFoodTrials` (status "testing"), so Dr. Poo has the exposure count and tendency.
- `patientMessages` format is unchanged -- the question reaches Dr. Poo identically.

### What Dr. Poo loses

- Individual `culpritCount` and `safeCount` for eggs -- but `exposures: 2` and `tendency: "neutral"` convey the same signal.
- If eggs were in a non-active status (e.g., "safe" or "graduated"), Dr. Poo would only see the display name in `recentSafe` without the trial details. However, if the user is asking about eggs causing problems, and eggs are "safe" status, Dr. Poo should note this is unexpected and the egg trial data is available via `foodTrialCounts` in the patient snapshot.

### Net assessment: ACCEPTABLE

The question-answering case works because active trials (testing/building) include the fields Dr. Poo needs. Safe/graduated foods are correctly reduced to names only because there's nothing to investigate.

---

## Risk Assessment: Information Loss Scenarios

### Risk 1: Filtering to "active trials only" hides useful food context

**Severity: LOW**

The new format sends up to 25 food items across three categories:

- `activeFoodTrials`: max 10 (testing/building status)
- `recentSafe`: max 10 (safe status, display names only)
- `recentFlags`: max 5 (watch/avoid status, with reasoning)

Foods in "graduated" or "dormant" status are excluded. This is intentional -- these foods have left the active trial pipeline and aren't relevant to current analysis.

**Edge case**: A "graduated" food that the user re-introduces after months of not eating it. If the user logs it, the food matching pipeline will create a new assessment event, potentially changing its status back to "testing." Until that happens, Dr. Poo won't see the historical trial data. However, Dr. Poo WILL see the food in `recentEvents.foodsEaten` and can comment on it based on the name alone.

**Verdict**: Acceptable. The graduated/dormant exclusion is correct behavior. If the user re-eats a graduated food and has problems, the assessment pipeline will flag it.

### Risk 2: 24h habit/fluid window (down from 72h) misses relevant patterns

**Severity: LOW-MEDIUM**

**What's lost**: Individual habit and fluid log entries from 25-72h ago.

**What mitigates it**:

1. `deltas.habitStreaks` captures multi-day streaks (computed from ALL logs, not just the 24h window).
2. `baselineComparison.habitDeltas` and `baselineComparison.fluidDeltas` capture overall trend data.
3. `weeklyTrends` includes weekly aggregates.

**Edge case**: A user who had an unusual fluid intake spike 48h ago (e.g., drank alcohol heavily 2 days ago). In the OLD format, Dr. Poo could see the individual fluid logs showing the spike. In the NEW format, Dr. Poo would only see the baseline delta if it affected the overall average.

**Verdict**: Low risk for most users. The baseline comparison and weekly trends capture the patterns Dr. Poo needs. For acute one-off events, the 24h window might miss a relevant data point, but habit/fluid patterns are typically multi-day and captured by streaks/baselines.

### Risk 3: Variable food window helps or hurts edge cases

**Severity: VERY LOW (net positive)**

**Helps**: Slow-transit patients (opioids, iron, pregnancy) now get 96h food windows instead of 72h. This catches foods that are genuinely still in transit.

**Helps**: Fast-transit patients (ileostomy reversal) get 48h windows, reducing noise from foods that have definitely already passed.

**Hurts**: If a non-ileostomy patient has unexpectedly fast transit and a relevant food was eaten 47h ago, both old (72h) and new (72h for non-ileostomy) windows would capture it. No loss.

**Verdict**: The variable window is strictly better than the fixed 72h window.

### Risk 4: Loss of per-trial `culpritCount`/`safeCount`/`totalTrials` for flagged foods

**Severity: LOW-MEDIUM**

In the OLD format, every food trial included explicit counts. In the NEW format, flagged foods (watch/avoid) include `latestReasoning` which typically embeds this information (e.g., "Triggered loose stool 3 of 5 times"), but the reasoning string is written by the AI, not guaranteed to include exact counts.

**Mitigation**: The `activeFoodTrials` array for testing/building foods includes `exposures` (totalAssessments) and `tendency`, which are the most important fields for Dr. Poo's decision-making during active trials.

**When it matters**: If Dr. Poo is deciding between "keep watching" and "upgrade to avoid" for a watch-status food, having `culpritCount: 4, safeCount: 1, totalTrials: 5` is more precise than `latestReasoning: "Frequently causes problems."` However, the `latestReasoning` is refreshed on each assessment and typically includes the key stats.

**Verdict**: Minor risk. The `latestReasoning` field is an adequate proxy in most cases. If user testing reveals that Dr. Poo makes poor watch-to-avoid escalation decisions, we could add `culpritCount`/`safeCount` to the `recentFlags` objects.

### Risk 5: `stillInTransit` list accuracy

**Severity: VERY LOW**

The NEW format adds a `stillInTransit` list for foods that are outside the normal event window but still within their learned transit time. This is entirely new functionality -- the OLD format had no equivalent.

**Edge case**: If a food trial's `learnedTransitCenterMinutes` is inaccurate (too high), a food could appear in `stillInTransit` when it has actually already passed. However, this would only add information, never remove it -- it's a false positive, not a false negative.

**Verdict**: Strictly additive. No risk of information loss.

---

## Overall Verdict

| Category                 | Assessment                                                             |
| ------------------------ | ---------------------------------------------------------------------- |
| Food log coverage        | IMPROVED (variable window matches actual transit)                      |
| BM log coverage          | NEUTRAL (48h fixed in both; old was 72h but 48h captures relevant BMs) |
| Habit/fluid log coverage | SLIGHTLY REDUCED (24h vs 72h, mitigated by baselines and streaks)      |
| Food trial detail        | REDUCED BUT CURATED (active trials detailed, safe/flags summarized)    |
| Patient context          | IMPROVED (snapshot with surgery, transit, trend, medication)           |
| Delta signals            | NEW (Bristol change, culprit exposure, habit streaks)                  |
| Transit-aware features   | NEW (stillInTransit, variable food window)                             |
| Token efficiency         | IMPROVED (structured payload, curated food trials)                     |

**Recommendation**: The new format is a net improvement for Dr. Poo's analysis quality. The only area to monitor is whether the reduced detail in flagged food trials causes weaker escalation recommendations. This can be verified during live testing in WQ-319.
