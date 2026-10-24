/**
 * Preserve the narrator/player distinction when sending story text to AI.
 * Spoken dialogue can use straight or Brazilian typographic quotation marks.
 */
export function serializeUserMessageForModel(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return content;

  const blocks: string[] = [];
  const lines = trimmed.split(/\n+/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const straightDialogue = /^"[^"]+"$/.test(line);
    const typographicDialogue = /^“[^”]+”$/.test(line);
    if (straightDialogue || typographicDialogue) {
      blocks.push(
        `<DIALOGUE speaker="protagonist">\n${line.slice(1, -1).trim()}\n</DIALOGUE>`,
      );
      continue;
    }

    if (/^\[[\s\S]+\]$/.test(line)) {
      blocks.push(
        `<MEMORY_OR_DREAM speaker="protagonist">\n${line.slice(1, -1).trim()}\n</MEMORY_OR_DREAM>`,
      );
      continue;
    }

    if (/^\*[^*]+\*$/.test(line)) {
      blocks.push(
        `<MENTAL_SPEECH speaker="protagonist">\n${line.slice(1, -1).trim()}\n</MENTAL_SPEECH>`,
      );
      continue;
    }

    blocks.push(`<USER_TEXT>\n${line}\n</USER_TEXT>`);
  }

  return blocks.join("\n\n");
}
