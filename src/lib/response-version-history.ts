/** Display only versions tied to the exact saved assistant message.
 * Historical answers may be outside the most recent 100-message window,
 * so their details are fetched on demand instead of inferred from chat state.
 */
export type SavedResponseVersion = {
  id: string;
  content: string;
  is_selected: boolean;
};

export type ResponseVersionEntry = {
  id: string;
  content: string;
  selected: boolean;
};

export function responseVersionEntries(
  original: string,
  alternatives: readonly SavedResponseVersion[],
): ResponseVersionEntry[] {
  const selectedAlternative = alternatives.some((v) => v.is_selected);
  return [
    { id: "original", content: original, selected: !selectedAlternative },
    ...alternatives.map((version) => ({
      id: version.id,
      content: version.content,
      selected: version.is_selected,
    })),
  ];
}
