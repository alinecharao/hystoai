/**
 * Preserve the user's narrative verbatim. Dividing large messages into
 * inferred dialogue/thought blocks loses chronology and misclassifies *actions*
 * as mental speech. The model receives the original text, in original order.
 *
 * The story-format contract is explained in the system prompt, not guessed
 * by a line-by-line parser.
 */
export function serializeUserMessageForModel(content: string): string {
  if (!content.trim()) return content;
  return `<USER_NARRATIVE role="user" source="verbatim">
${content}
</USER_NARRATIVE>`;
}
