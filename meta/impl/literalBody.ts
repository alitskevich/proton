/**
 * A pattern as the body of a regex literal: a `/` outside a character class and not escaped gets its `\`. A `\`
 * escapes the next character only when it is not itself escaped, so `a\\/b` (a backslash, then `/`) gets one too.
 */
export function literalBody(pattern: string) {
  let inClass = false;
  let escaped = false;
  return [...pattern]
    .map((char) => {
      const bare = !escaped;
      escaped = bare && char === "\\";
      if (bare && char === "[") inClass = true;
      if (bare && char === "]") inClass = false;
      return char === "/" && bare && !inClass ? "\\/" : char;
    })
    .join("");
}
