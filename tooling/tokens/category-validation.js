/**
 * Token category validation.
 * @file Enforce injected shared membership and exact-scope classification after independent fallback.
 */

import { scopeList } from "./formats.js";

/**
 * Classify a syntax rule from exact reviewed scope evidence, retaining the default standard policy.
 * @param rule - Effective rule in this theme.
 * @param snapshot - Local classification snapshot.
 */
export function syntaxCategory(rule, snapshot) {
  /** Evidence categories covering this rule's actual scope expressions. */
  const known = scopeList(rule)
    .map((scope) => snapshot.scopes.get(scope)?.evidence.category)
    .filter(Boolean);

  if (known.includes("nonStandard")) return "nonStandard";
  if (known.includes("deprecated")) return "deprecated";
  if (known.includes("sourceCode")) return "sourceCode";

  return "standard";
}

/**
 * Validate normalized effective definitions/details with precise authority diagnostics.
 * @param families - Decoded effective families, indexed by definitions/details then family.
 * @param snapshot - Injected shared definition/detail authorities and scope index.
 * @param target - Target label, including its group/name.
 */
export function validateCategories(families, snapshot, target) {
  for (const family of ["ui", "semantic", "syntax"]) {
    for (const record of families.definitions[family].records.values()) {
      /** Exact family-specific authority, never inferred from styling or enabled state. */
      const authority =
        family === "syntax"
          ? undefined
          : (snapshot.definitions[family].records.get(record.id) ?? snapshot.details[family].records.get(record.id));
      const expected =
        family === "syntax" ? syntaxCategory(record.value, snapshot) : (authority?.category ?? "nonStandard");
      const standard =
        family !== "syntax" && snapshot.definitions[family].records.get(record.id)?.category === "standard";

      if (record.category !== expected || (record.category === "standard" && family !== "syntax" && !standard))
        throw new Error(
          `${target}: ${record.label}: ${family} token "${record.id}" is in "${record.category}", expected "${expected}"; authority ${authority?.label ?? (family === "syntax" ? "reviewed exact-scope evidence (unknown scopes default to standard)" : snapshot.definitions[family].input.path)}: ${record.category === "standard" && !standard && family !== "syntax" ? "no exact standard definition membership" : "category conflicts with accepted evidence"}. Review the token and authority together.`,
        );
    }

    for (const record of families.details[family].records.values()) {
      /** Details use their independently selected effective definition category. */
      const definition = families.definitions[family].records.get(record.id);

      if (definition && record.category !== definition.category)
        throw new Error(
          `${target}: ${record.label}: ${family} detail "${record.id}" is in "${record.category}"; expected "${definition.category}" from ${definition.label}`,
        );

      if (
        family === "syntax" &&
        definition &&
        families.details.syntax.input.fallback &&
        !families.definitions.syntax.input.fallback
      ) {
        /** Accepted shared reference scope coverage must match an inherited description. */
        const reference =
          snapshot.details.syntax.records.get(record.id)?.value.scopeEvidence?.scopes.map((item) => item.selector) ??
          snapshot.referenceScopes?.get(record.id);

        if (reference && JSON.stringify(reference) !== JSON.stringify(scopeList(definition.value)))
          throw new Error(
            `${target}: ${record.label}: inherited syntax details for "${record.id}" do not match effective scopes; supply local matching details`,
          );
      }
    }
  }
}
