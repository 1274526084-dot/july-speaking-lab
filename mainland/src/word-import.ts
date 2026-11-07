export type WordImportEntry = { term: string; meaning: string };
export type WordImportResult = {
  entries: WordImportEntry[];
  rejected: { line: number; text: string }[];
};

const PART_OF_SPEECH = '(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|interj|int|phr)';
const TRAILING_PART_OF_SPEECH = new RegExp(
  `(?:\\s+${PART_OF_SPEECH}\\.(?:\\s*[/、]\\s*${PART_OF_SPEECH}\\.)*|\\s*[（(]\\s*${PART_OF_SPEECH}\\.?(?:\\s*[/、]\\s*${PART_OF_SPEECH}\\.?)*\\s*[）)])$`,
  'i',
);

function normalizeTerm(value: string) {
  return value
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐‑]/g, '-')
    .trim()
    .replace(/[\s:：,，;；–—]+$/g, '')
    .replace(TRAILING_PART_OF_SPEECH, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Keep Chinese glosses intact; spaces inside an English phrase are never entry separators. */
export function parseWordImport(value: string): WordImportResult {
  const entries = new Map<string, WordImportEntry>();
  const rejected: WordImportResult['rejected'] = [];

  for (const [index, original] of value.replace(/\uFEFF/g, '').split(/\r\n?|\n/).entries()) {
    const line = original.trim();
    if (!line) continue;
    const pipe = line.search(/[|｜]/);
    const chinese = line.search(/[\u3400-\u9fff]/);
    let candidates: { word: string; meaning: string }[];

    if (pipe >= 0) {
      candidates = [{ word: line.slice(0, pipe), meaning: line.slice(pipe + 1).trim() }];
    } else if (chinese >= 0) {
      let word = line.slice(0, chinese).trim();
      let meaning = line.slice(chinese).trim();
      // A Chinese gloss in parentheses is a separator, not part of the lookup term.
      if (/[（(]\s*$/.test(word)) {
        word = word.replace(/[（(]\s*$/, '').trim();
        meaning = meaning.replace(/[）)]\s*$/, '').trim();
      }
      candidates = [{ word, meaning }];
    } else {
      candidates = line.split(/[,，;；\t]+/).filter(part => part.trim()).map(word => ({ word, meaning: '' }));
    }

    for (const candidate of candidates) {
      const term = normalizeTerm(candidate.word);
      if (!/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*)*$/.test(term) || term.length > 80) {
        rejected.push({ line: index + 1, text: line });
        continue;
      }
      const existing = entries.get(term);
      if (!existing) entries.set(term, { term, meaning: candidate.meaning });
      else if (!existing.meaning && candidate.meaning) existing.meaning = candidate.meaning;
    }
  }
  return { entries: [...entries.values()], rejected };
}
