/**
 * One field of a `.meta/forms` form: a `Forma` field or a table column. The generated `forms.ts` checks every form
 * against it, so a malformed `.json` fails the project's typecheck. A language overlay holds `id` and the
 * translated keys alone.
 */
export type FormField = {
  id: string;
  /** The data key the field edits, when it is not `id`. */
  field?: string;
  tab?: string;
  group?: string;
  name?: string;
  /** The Forma field type, or the `TableCell.<Type>` of a column; none is text. */
  type?: string;
  /** `type` switched off: a `2` suffix disables an attribute. */
  type2?: string;
  /** The `R.enums` vocabulary of an `enum` or `radio`, the form of an `object`, the kind a `ref` names. */
  typeSpec?: string;
  /** The value is a list of `type`/`typeSpec`. */
  isMulti?: boolean;
  /** The value is a string-keyed map of `type`/`typeSpec`. */
  isMap?: boolean;
  /** The value may be `null`. */
  nullable?: boolean;
  /** The least / greatest text length or number. */
  min?: number;
  max?: number;
  /** The number is more than / less than this. */
  exclusiveMin?: number;
  exclusiveMax?: number;
  /** A `url`'s scheme pattern. */
  protocol?: string;
  /** A regular expression the text matches, and the `message` when it does not. */
  pattern?: string;
  message?: string;
  /** The value is a list of at least / at most so many items. */
  minItems?: number;
  maxItems?: number;
  /** The value when the input is invalid (`.catch`). */
  fallback?: unknown;
  /** The one value it may hold (`z.literal`). */
  const?: unknown;
  /** A `|` pipe of `trim`/`toLowerCase`/`toUpperCase`, then primitive or struct checks and `.meta/functions.json` functions. */
  refine?: string;
  /** A predicate (`format=enum`): the form shows the field only while it holds. */
  visible?: string;
  /** On a table column: off until the Columns menu shows it. */
  hidden?: boolean;
  required?: string | boolean;
  disabled?: string | boolean;
  /** The value when the input has none. */
  default?: unknown;
  /** On a table column: its CSS grid track. */
  width?: string;
  hint?: string;
  placeholder?: string;
  example?: string;
};

/** A `{ items }` source: a vocabulary of `.meta/enums`, `primitives.json`, `functions.json`; a `$comment` is its note. */
export type ItemsSource = { $comment?: string; items: Record<string, unknown>[] };
