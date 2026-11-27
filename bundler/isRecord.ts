/** Narrows a value of unknown type to a plain object whose keys can be read: not `null`, not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
