const SPANISH_NUM_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  medio: 0.5,
  media: 0.5,
};

function normalizeNumericToken(token: string): number | null {
  let s = token.trim().replace(/\$/g, '').replace(/\s+/g, '');
  if (!s) return null;

  const low = s.toLowerCase();
  if (low in SPANISH_NUM_WORDS) {
    return SPANISH_NUM_WORDS[low];
  }

  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
  } else if (s.includes(',')) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }

  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalizes numbers and Spanish/Argentine shorthand amount strings into a finite number.
 * Examples: "889 mil" -> 889000, "1.5m" -> 1500000, "2 millones y medio" -> 2500000,
 * "45k" -> 45000, "$147.060,50" -> 147060.5.
 */
export function parseArgentineAmount(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }

  let text = String(raw).trim().toLowerCase();
  if (!text) return 0;

  text = text.replace(/ars|pesos|\$/g, '').trim();
  text = text.replace(/^(=|de)\s+/, '').trim();

  const millionMatch = text.match(
    /(\d+(?:[.,]\d+)?|un|uno|una)\s*(?:mill[oó]n(?:es)?|palos?|m\b)(.*)/,
  );
  if (millionMatch) {
    const base = normalizeNumericToken(millionMatch[1]);
    if (base !== null) {
      let total = base * 1_000_000;
      const rest = (millionMatch[2] || '').trim();
      if (rest) {
        if (rest.includes('medio') || rest.includes('media')) {
          total += 500_000;
        } else {
          const restClean = rest.replace(/^(y|con)\s+/, '').trim();
          if (restClean) {
            total += parseArgentineAmount(restClean);
          }
        }
      }
      return Math.round(total * 100) / 100;
    }
  }

  const compactM = text.match(/^(\d+(?:[.,]\d+)?)\s*m$/);
  if (compactM) {
    const val = normalizeNumericToken(compactM[1]);
    return val !== null ? Math.round(val * 1_000_000 * 100) / 100 : 0;
  }

  const thousandMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|lucas?|k\b)/);
  if (thousandMatch) {
    const val = normalizeNumericToken(thousandMatch[1]);
    if (val !== null) {
      return Math.round(val * 1_000 * 100) / 100;
    }
  }

  const numMatch = text.match(/\d+(?:[.,]\d+)*/);
  if (numMatch) {
    const val = normalizeNumericToken(numMatch[0]);
    if (val !== null) {
      return Math.round(val * 100) / 100;
    }
  }

  return 0;
}
