/** Column named by a PostgREST schema-cache error, or null for any other failure. */
export function missingSchemaColumn(message: string): string | null {
  if (!/column|schema cache|does not exist|could not find/i.test(message)) {
    return null;
  }
  const quoted = /Could not find the '([^']+)' column/i.exec(message);
  if (quoted?.[1]) return quoted[1];
  const generic = /column ["']?([a-z0-9_]+)["']?/i.exec(message);
  return generic?.[1] || null;
}
