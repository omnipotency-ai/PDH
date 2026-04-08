/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aggregateQueries from "../aggregateQueries.js";
import type * as ai from "../ai.js";
import type * as aiAnalyses from "../aiAnalyses.js";
import type * as appConfig from "../appConfig.js";
import type * as backup from "../backup.js";
import type * as computeAggregates from "../computeAggregates.js";
import type * as conversations from "../conversations.js";
import type * as extractInsightData from "../extractInsightData.js";
import type * as foodAssessments from "../foodAssessments.js";
import type * as foodLibrary from "../foodLibrary.js";
import type * as foodLlmMatching from "../foodLlmMatching.js";
import type * as foodParsing from "../foodParsing.js";
import type * as foodRequests from "../foodRequests.js";
import type * as ingredientExposures from "../ingredientExposures.js";
import type * as ingredientNutritionApi from "../ingredientNutritionApi.js";
import type * as ingredientOverrides from "../ingredientOverrides.js";
import type * as ingredientProfiles from "../ingredientProfiles.js";
import type * as lib_apiKeys from "../lib/apiKeys.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_coerce from "../lib/coerce.js";
import type * as lib_inputSafety from "../lib/inputSafety.js";
import type * as lib_knownFoods from "../lib/knownFoods.js";
import type * as lib_openai from "../lib/openai.js";
import type * as logs from "../logs.js";
import type * as migrations from "../migrations.js";
import type * as profileMutations from "../profileMutations.js";
import type * as profiles from "../profiles.js";
import type * as search from "../search.js";
import type * as seedTestData from "../seedTestData.js";
import type * as testFixtures from "../testFixtures.js";
import type * as validators from "../validators.js";
import type * as weeklySummaries from "../weeklySummaries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aggregateQueries: typeof aggregateQueries;
  ai: typeof ai;
  aiAnalyses: typeof aiAnalyses;
  appConfig: typeof appConfig;
  backup: typeof backup;
  computeAggregates: typeof computeAggregates;
  conversations: typeof conversations;
  extractInsightData: typeof extractInsightData;
  foodAssessments: typeof foodAssessments;
  foodLibrary: typeof foodLibrary;
  foodLlmMatching: typeof foodLlmMatching;
  foodParsing: typeof foodParsing;
  foodRequests: typeof foodRequests;
  ingredientExposures: typeof ingredientExposures;
  ingredientNutritionApi: typeof ingredientNutritionApi;
  ingredientOverrides: typeof ingredientOverrides;
  ingredientProfiles: typeof ingredientProfiles;
  "lib/apiKeys": typeof lib_apiKeys;
  "lib/auth": typeof lib_auth;
  "lib/coerce": typeof lib_coerce;
  "lib/inputSafety": typeof lib_inputSafety;
  "lib/knownFoods": typeof lib_knownFoods;
  "lib/openai": typeof lib_openai;
  logs: typeof logs;
  migrations: typeof migrations;
  profileMutations: typeof profileMutations;
  profiles: typeof profiles;
  search: typeof search;
  seedTestData: typeof seedTestData;
  testFixtures: typeof testFixtures;
  validators: typeof validators;
  weeklySummaries: typeof weeklySummaries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
