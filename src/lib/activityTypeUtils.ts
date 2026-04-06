export function normalizeActivityTypeKey(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (key === "sleeping") return "sleep";
  if (key === "walk") return "walking";
  return key;
}
