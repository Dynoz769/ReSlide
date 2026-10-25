// Picks a modern layout for each slide based on the shape of its content.
// Layouts only decide presentation; the content itself is never rewritten.

export const LAYOUTS = {
  cover: 'Muka depan',
  section: 'Pembahagi seksyen',
  bullets: 'Senarai beranimasi',
  cards: 'Kad grid',
  stats: 'Statistik (kiraan naik)',
  timeline: 'Garis masa / langkah',
  split: 'Teks + gambar',
  gallery: 'Galeri gambar',
  table: 'Jadual',
  quote: 'Petikan',
  text: 'Perenggan',
};

const STEP = /^(langkah|step|fasa|phase|tahap|stage|minggu|week|hari|day|bulan|month|\d{4}\b|q[1-4]\b|\d+[.)]\s)/i;

export function autoLayout(slide, index, total) {
  const ps = slide.paragraphs;
  const top = ps.filter(p => p.level === 0);
  const words = ps.reduce((n, p) => n + p.text.split(/\s+/).length, 0);
  const longest = ps.reduce((m, p) => Math.max(m, p.text.length), 0);

  if (slide.tables.length) return 'table';
  if (slide.isCover || (index === 0 && ps.length <= 2 && !slide.images.length)) return 'cover';
  if (slide.images.length && !ps.length) return 'gallery';
  if (slide.images.length) return 'split';
  if (!ps.length) return 'section';
  if (index === total - 1 && ps.length === 1 && ps[0].text.length < 120) return 'cover';
  if (ps.length === 1 && /^["“”'‘«]/.test(ps[0].text.trim())) return 'quote';
  if (ps.length === 1 && ps[0].text.length > 60 && !slide.title) return 'quote';

  const stepCount = top.filter(p => STEP.test(p.text.trim())).length;
  if (top.length >= 3 && top.length <= 7 && stepCount >= top.length - 1 && ps.length === top.length) return 'timeline';

  const numericCount = top.filter(p => STAT_RE.test(p.text.trim()) && p.text.length < 120).length;
  if (top.length >= 2 && top.length <= 6 && numericCount === top.length && ps.length === top.length) return 'stats';

  if (ps.length <= 2 && longest > 160) return 'text';
  if (top.length >= 2 && top.length <= 4 && ps.length === top.length && longest <= 140) return 'cards';
  if (words > 170 && ps.length <= 3) return 'text';
  return 'bullets';
}

// Leading figure, optionally after a currency/sign: "85% ...", "RM 2.5 juta ...", "1,200 ...".
export const STAT_RE = /^((?:RM|USD|MYR|US\$|S\$|\$|€|£|¥|~|≈|\+|>|<)?\s?)([\d][\d.,]*)(\s?(?:%|\+|(?:k|K|m|M|j|bil|juta|ribu|x)(?![\p{L}]))?)([\s\S]*)$/u;

// Guard a (possibly user-chosen) layout so that every piece of content
// on the slide still has a place to render.
export function safeLayout(slide, layout) {
  const ps = slide.paragraphs;
  if (slide.tables.length) return 'table';
  if (slide.images.length && !['cover', 'split', 'gallery'].includes(layout)) return ps.length ? 'split' : 'gallery';
  if (!slide.images.length && (layout === 'split' || layout === 'gallery')) return ps.length ? 'bullets' : 'section';
  if (layout === 'section' && ps.length) return 'bullets';
  if (layout === 'quote' && !ps.length) return 'section';
  if (layout === 'stats' && (!ps.length || !ps.every(p => p.level === 0 && STAT_RE.test(p.text)))) return 'cards';
  if (['cards', 'timeline'].includes(layout) && !ps.length) return 'section';
  if (['cards', 'timeline'].includes(layout) && ps.some(p => p.level > 0)) return 'bullets';
  return layout;
}

export function applyLayouts(deck, overrides = {}) {
  deck.slides.forEach((s, i) => {
    s.autoLayout = safeLayout(s, autoLayout(s, i, deck.slides.length));
    s.layout = safeLayout(s, overrides[i] || s.autoLayout);
  });
  return deck;
}
