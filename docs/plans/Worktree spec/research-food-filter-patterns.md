# Food Tracker Filter/Search UX Patterns: Cross-App Research

> Researched from MyFitnessPal, Cronometer, Lose It!, Yazio, FatSecret, Noom, and others.

## 1. What do users filter by?

The major apps converge on a common set of filter dimensions:

- **Personal history tabs**: MyFitnessPal uses "Recent," "Frequent," and "My Foods" tabs. Cronometer offers "Favourites," "Common," and "Restaurants." Lose It learns favourites and ranks search results by personal logging history.
- **Custom/created foods**: Every major app has a "My Foods" or equivalent section for user-created entries, recipes, and saved meals.
- **Meal type**: Most apps organise logging by meal slot (Breakfast, Lunch, Dinner, Snacks), but this is a **diary-level organiser, not a search filter**. You choose the meal slot first, then search within it.
- **Barcode scan**: Universally present. A separate entry path, not a filter.
- **Dietary preferences**: MyFitnessPal allows filtering by vegan, vegetarian, pescatarian. Relatively uncommon.

## 2. Search vs. Filter — are they separate?

They are **not clearly separated** in most apps. The dominant pattern is a **single search bar with tab-based pre-filters** above or below it (Recent / Frequent / Favourites / All). The tabs narrow the pool before text search is applied.

There is no "advanced filter panel" with checkboxes in any mainstream food tracker.

## 3. Default view before search (the "zero state")

Nearly every app shows a **personalised list before the user types anything**:

- **MyFitnessPal**: Recent and Frequent tabs, plus Suggested Searches based on past behaviour
- **Cronometer**: Recently logged foods appear immediately when search opens. Sort by "Most Recent" or "Most Frequent"
- **Lose It**: Favourites and personalised search rankings based on logging history + global popularity. Caches recent foods offline.
- **Noom**: Colour-coded food categories (green/yellow/orange) with a lookup tool

**The pattern is clear: the zero-state is "your foods," not "all foods."**

## 4. Filtering by nutritional content

This is **rare**. No major app offers a "high protein" or "low carb" filter in the search flow itself.

- Noom uses a colour-coded system (green = nutrient-dense, orange = calorie-dense) but this is a classification overlay, not a search filter
- Some apps show macros inline in search results so users can scan visually
- Explicit nutritional range filters **do not exist** in mainstream food trackers

## 5. Primary purpose of filtering

**Speed.** The entire filter/search UX is optimised for reducing time-to-log. Research cited by Lose It shows photo logging is 3.5x faster than manual entry, and apps that minimise friction see significantly higher adherence.

The filter system exists to surface "the thing you probably ate" as fast as possible — not to help users discover new foods or plan meals.

## Implications for PDH

- The **zero-state should be personal**: recently logged foods for the current meal slot (time-based auto-detection)
- Tabs should be: **Recent | Frequent | Favourites | All** (not meal slots)
- Meal slot selection is for **where to log TO** — separate from searching/filtering
- Macro-based filtering is uncommon in food trackers but could make sense for PDH's food reintroduction context (filtering by food group, digestion risk, etc.)
- The filter panel in the Nutrition card should be lightweight — heavy filtering belongs on the Database/Patterns page
