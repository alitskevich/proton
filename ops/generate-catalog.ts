import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";
import type { ComponentPropertyDefinition, ComponentSignature } from "arrmatura";
import { type Scalar, stringSplit, type XmlNode, xmlParse } from "ultimus";

const ROOT_DIR = path.resolve(".");
// `generate-catalog.ts [sourceDirs] [outFile] [--extended]`, source dirs comma-separated and relative to cwd.
// Defaults keep the single-kit call sites (`cd ./atomic && generate-catalog.ts`) working unchanged.
// `--extended` adds each signature's `<Prop>`s and `<State>`s as `properties`, told apart by `kind`.
const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: { extended: { type: "boolean" } },
});
const EXTENDED = flags.extended === true;
const [DIRS_ARG, OUT_ARG] = positionals;
const SOURCE_DIRS = stringSplit(DIRS_ARG || "cml").map((dir) => path.join(ROOT_DIR, dir));
const OUTPUT_PATH = path.join(ROOT_DIR, OUT_ARG || "catalog.json");

// `<Component>` may sit at the root or inside a wrapper (`<Components>`, `<components>`), so collect by
// walking instead of special-casing the wrapper name. Does not descend into a component's own body.
function collectComponents(nodes: XmlNode[] | undefined): XmlNode[] {
  return (nodes ?? []).flatMap((node) =>
    node?.tag === "Component" && node.attrs?.id ? [node] : collectComponents(node?.nodes),
  );
}

/** An attribute as catalog text; xmlParse coerces values to scalars. */
const text = (value: Scalar | null | undefined) => (value == null ? undefined : String(value));

/** A `<Prop>`, `<State>` or `<Var>` as catalog data: its attributes, `id` as `name`, `enum` split on commas. */
function propertyOf({ attrs }: XmlNode, kind: ComponentPropertyDefinition["kind"]): ComponentPropertyDefinition {
  const { id, type, required, enum: values, ...rest } = attrs ?? {};
  return {
    name: text(id) ?? "",
    type: text(type) ?? "any",
    kind,
    ...(required === true ? { required } : {}),
    ...(values == null
      ? {}
      : {
          enum: String(values)
            .split(",")
            .map((value) => value.trim()),
        }),
    ...rest,
  };
}

/**
 * A Signature's `<Prop>`s and `<State>`s in document order. A service's `<State id>` is one output; a template's
 * `<State>` wraps one `<Var>` per local variable.
 */
const propertiesOf = (nodes: XmlNode[]) =>
  nodes.flatMap((node) => {
    if (node.tag === "Prop") return [propertyOf(node, "prop")];
    if (node.tag !== "State") return [];
    const states = node.attrs?.id ? [node] : (node.nodes ?? []).filter((child) => child.tag === "Var");
    return states.map((state) => propertyOf(state, "state"));
  });

/** Absolute paths of every catalogable `.xml` under one source dir, sorted for a stable diff. */
async function scan(dir: string) {
  // A module has `cml/`, `src/`, or both — so half of a symmetric dir list is legitimately absent.
  // The caller passes both halves for every module; missing ones are not an error.
  if (!existsSync(dir)) return [];
  // Recursive: components live in subfolders too (e.g. table/cml/TableCell.Date.xml).
  const files = await fs.readdir(dir, { recursive: true });
  // `_`-prefixed files (e.g. `_safelist.xml`) are internal, and `<Name>.demo.xml` gallery pages
  // sit beside the component they demo — neither is a catalogued component.
  return files
    .filter((file) => file.endsWith(".xml") && !file.endsWith(".demo.xml") && !path.basename(file).startsWith("_"))
    .sort()
    .map((file) => path.join(dir, file));
}

async function main() {
  console.log(`Scanning ${SOURCE_DIRS.join(", ")}...`);
  const xmlFiles = (await Promise.all(SOURCE_DIRS.map(scan))).flat();

  const catalog: ComponentSignature[] = [];
  // Several kits can declare the same id (an override); the first one scanned wins, matching
  // the order the dirs were passed in.
  const seen = new Set<string>();

  for (const filePath of xmlFiles) {
    const file = path.relative(ROOT_DIR, filePath);

    let componentNodes: XmlNode[];
    try {
      componentNodes = collectComponents(xmlParse(await fs.readFile(filePath, "utf-8")));
    } catch (error) {
      console.error(`Failed to read or parse ${file}:`, error);
      continue;
    }
    // A file yielding nothing is how the earlier wrapper-case and recursion bugs stayed invisible.
    if (componentNodes.length === 0) {
      console.warn(`No components found in ${file}`);
    }

    componentNodes.forEach((componentNode) => {
      const id = String(componentNode.attrs?.id);
      if (seen.has(id)) return;
      seen.add(id);
      const signatureNode = componentNode.nodes?.find((node) => node.tag === "Signature");
      const attrs = signatureNode?.attrs ?? {};
      if (signatureNode && !attrs.private) {
        const kind = attrs.kind === "component" || attrs.kind === "service" ? attrs.kind : undefined;
        const signature: ComponentSignature = {
          id,
          // Only services carry it, so leave it off UI components rather than defaulting it in.
          ...(kind ? { kind } : {}),
          description: text(attrs.description) ?? id,
          purpose: text(attrs.purpose),
          name: text(attrs.name) ?? id,
          icon: text(attrs.icon),
          group: text(attrs.group),
          file,
          ...(EXTENDED ? { properties: propertiesOf(signatureNode.nodes ?? []) } : {}),
        };

        catalog.push(signature);
      }
    });
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Generated catalog with ${catalog.length} components at ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
