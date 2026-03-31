/**
 * Shared filter-value coercion utility for the database feature.
 * Used by both FilterSheet and column filterFn definitions.
 */
export function coerceFilterValues<T extends string>(filterValue: unknown): T[] {
  if (Array.isArray(filterValue)) {
    return filterValue.filter((value): value is T => typeof value === "string");
  }
  if (typeof filterValue === "string") {
    return [filterValue as T];
  }
  return [];
}

export function getColumnFilterValues<T extends string>(
  filters: ReadonlyArray<{ id: string; value: unknown }>,
  columnId: string,
): T[] {
  const entry = filters.find((filter) => filter.id === columnId);
  return entry ? coerceFilterValues<T>(entry.value) : [];
}
