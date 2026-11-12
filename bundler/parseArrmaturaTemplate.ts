import { createRegisterTypes, type IComponentDescriptor } from "arrmatura";
import { type XmlNode, xmlParse } from "ultimus";

/** One component of a CML file, its template pre-parsed so the bundle ships no XML parsing. */
export type ParsedTemplate = { tag: string; template: XmlNode[] };

/** The components a CML source declares, in source order. Throws on markup that does not parse. */
export function parseArrmaturaTemplate(source: string): ParsedTemplate[] {
  const registry: ParsedTemplate[] = [];

  createRegisterTypes((descriptor: IComponentDescriptor) => {
    const tag = String(descriptor.tag);
    const template = xmlParse(descriptor.template as string);
    registry.push({ tag, template });
  })(source);

  return registry;
}
