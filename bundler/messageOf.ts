/** `error?.message` for a caught value of unknown type: the `message` string of an object, else `undefined`. */
export const messageOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : undefined;
