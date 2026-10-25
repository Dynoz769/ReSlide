// Parsers that turn an old presentation into a neutral deck model.
// The model keeps the original text (with bold/italic/underline) and images
// untouched; only the presentation layer is rebuilt later.
//
// Deck   = { title, slides: Slide[] }
// Slide  = { title, subtitle, paragraphs: Para[], images: Img[], tables: string[][][] }
// Para   = { html, text, level }
// Img    = { src, aspect }

const IMAGE_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp',
};

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function emptySlide() {
  return { title: '', subtitle: '', paragraphs: [], images: [], tables: [] };
}

function para(html, text, level = 0) {
  return { html, text, level };
}

/* ------------------------------------------------------------------ PPTX */

const kids = (el, name) => el ? [...el.children].filter(c => c.localName === name) : [];
const kid = (el, name) => kids(el, name)[0] || null;
const desc = (el, name) => el ? [...el.getElementsByTagNameNS('*', name)] : [];

function xml(str) {
  return new DOMParser().parseFromString(str, 'application/xml');
}

function resolvePath(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/');
  parts.pop();
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

async function readRels(zip, partPath) {
  const dir = partPath.substring(0, partPath.lastIndexOf('/'));
  const file = partPath.substring(partPath.lastIndexOf('/') + 1);
  const relPath = `${dir}/_rels/${file}.rels`;
  const entry = zip.file(relPath);
  const map = {};
  if (!entry) return map;
  const doc = xml(await entry.async('string'));
  for (const r of desc(doc, 'Relationship')) {
    map[r.getAttribute('Id')] = {
      target: r.getAttribute('TargetMode') === 'External'
        ? null : resolvePath(partPath, r.getAttribute('Target')),
      type: r.getAttribute('Type') || '',
    };
  }
  return map;
}

function runsToHtml(p) {
  let html = '';
  let text = '';
  for (const node of p.children) {
    const n = node.localName;
    if (n === 'r' || n === 'fld') {
      const t = desc(node, 't').map(x => x.textContent).join('');
      if (!t) continue;
      const rPr = kid(node, 'rPr');
      let piece = escapeHtml(t);
      if (rPr) {
        if (rPr.getAttribute('b') === '1') piece = `<strong>${piece}</strong>`;
        if (rPr.getAttribute('i') === '1') piece = `<em>${piece}</em>`;
        const u = rPr.getAttribute('u');
        if (u && u !== 'none') piece = `<u>${piece}</u>`;
      }
      html += piece;
      text += t;
    } else if (n === 'br') {
      html += '<br>';
      text += '\n';
    }
  }
  return { html, text };
}

function txBodyParas(txBody) {
  const out = [];
  for (const p of kids(txBody, 'p')) {
    const { html, text } = runsToHtml(p);
    if (!text.trim()) continue;
    const pPr = kid(p, 'pPr');
    const level = pPr ? parseInt(pPr.getAttribute('lvl') || '0', 10) : 0;
    out.push(para(html, text, level));
  }
  return out;
}

function maxFontSize(txBody) {
  let max = 0;
  for (const r of desc(txBody, 'rPr').concat(desc(txBody, 'defRPr'))) {
    const sz = parseInt(r.getAttribute('sz') || '0', 10);
    if (sz > max) max = sz;
  }
  return max;
}

function xfrmOf(el) {
  const xfrm = desc(el, 'xfrm')[0];
  const off = xfrm && kid(xfrm, 'off');
  const ext = xfrm && kid(xfrm, 'ext');
  return {
    x: off ? +off.getAttribute('x') : 0,
    y: off ? +off.getAttribute('y') : 0,
    w: ext ? +ext.getAttribute('cx') : 0,
    h: ext ? +ext.getAttribute('cy') : 0,
  };
}

// Flatten the shape tree (including groups) into positioned items.
function collectShapes(tree, out = [], groupPos = null) {
  for (const el of tree.children) {
    const n = el.localName;
    const pos = groupPos || xfrmOf(el);
    if (n === 'grpSp') {
      collectShapes(el, out, groupPos || xfrmOf(kid(el, 'grpSpPr') || el));
    } else if (n === 'sp' || n === 'pic' || n === 'graphicFrame') {
      out.push({ el, kind: n, pos });
    }
  }
  return out;
}

function placeholderType(el) {
  const ph = desc(el, 'ph')[0];
  if (!ph) return null;
  return ph.getAttribute('type') || 'body';
}

async function parseSlide(zip, path, slideSize) {
  const doc = xml(await zip.file(path).async('string'));
  const rels = await readRels(zip, path);
  const slide = emptySlide();
  const tree = desc(doc, 'spTree')[0];
  if (!tree) return slide;

  const shapes = collectShapes(tree).sort((a, b) => (a.pos.y - b.pos.y) || (a.pos.x - b.pos.x));
  const looseTexts = [];
  let hasCenterTitle = false;

  for (const s of shapes) {
    if (s.kind === 'sp') {
      const type = placeholderType(s.el);
      if (['sldNum', 'dt', 'ftr', 'hdr'].includes(type)) continue;
      const txBody = kid(s.el, 'txBody');
      if (!txBody) continue;
      const paras = txBodyParas(txBody);
      if (!paras.length) continue;
      if ((type === 'title' || type === 'ctrTitle') && !slide.title) {
        slide.title = paras.map(p => p.html).join('<br>');
        if (type === 'ctrTitle') hasCenterTitle = true;
      } else if (type === 'subTitle' && !slide.subtitle) {
        slide.subtitle = paras.map(p => p.html).join('<br>');
      } else {
        looseTexts.push({ paras, size: maxFontSize(txBody), placeholder: !!type });
      }
    } else if (s.kind === 'pic') {
      const blip = desc(s.el, 'blip')[0];
      const rid = blip && (blip.getAttribute('r:embed') ||
        blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'));
      const rel = rid && rels[rid];
      if (!rel || !rel.target) continue;
      const ext = rel.target.split('.').pop().toLowerCase();
      const mime = IMAGE_MIME[ext];
      const file = zip.file(rel.target);
      if (!mime || !file) continue;
      const coverage = (s.pos.w * s.pos.h) / (slideSize.cx * slideSize.cy || 1);
      const b64 = await file.async('base64');
      slide.images.push({
        src: `data:${mime};base64,${b64}`,
        aspect: s.pos.h ? s.pos.w / s.pos.h : 1.5,
        coverage,
      });
    } else if (s.kind === 'graphicFrame') {
      const tbl = desc(s.el, 'tbl')[0];
      if (!tbl) continue;
      const rows = kids(tbl, 'tr').map(tr =>
        kids(tr, 'tc').map(tc => txBodyParas(kid(tc, 'txBody')).map(p => p.html).join('<br>')));
      if (rows.length) slide.tables.push(rows);
    }
  }

  // No title placeholder: promote the largest short text box to the title.
  if (!slide.title && looseTexts.length) {
    let best = -1;
    looseTexts.forEach((t, i) => {
      const short = t.paras.length <= 2 && t.paras.every(p => p.text.length <= 90);
      if (short && (best < 0 || t.size > looseTexts[best].size)) best = i;
    });
    if (best >= 0) {
      slide.title = looseTexts[best].paras.map(p => p.html).join('<br>');
      looseTexts.splice(best, 1);
    }
  }
  for (const t of looseTexts) slide.paragraphs.push(...t.paras);

  // A full-bleed picture behind text is the old template background, not content.
  const hasText = slide.title || slide.paragraphs.length || slide.tables.length;
  slide.images = slide.images.filter(img => !(hasText && img.coverage > 0.85));
  slide.images.forEach(img => delete img.coverage);
  slide.isCover = hasCenterTitle;
  return slide;
}

export async function parsePptx(buffer) {
  if (!window.JSZip) throw new Error('JSZip gagal dimuatkan.');
  const zip = await window.JSZip.loadAsync(buffer);
  const presPath = 'ppt/presentation.xml';
  if (!zip.file(presPath)) throw new Error('Fail ini bukan PowerPoint (.pptx) yang sah.');
  const pres = xml(await zip.file(presPath).async('string'));
  const rels = await readRels(zip, presPath);
  const sz = desc(pres, 'sldSz')[0];
  const slideSize = { cx: sz ? +sz.getAttribute('cx') : 12192000, cy: sz ? +sz.getAttribute('cy') : 6858000 };

  const slides = [];
  for (const id of desc(pres, 'sldId')) {
    const rid = id.getAttribute('r:id') ||
      id.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = rels[rid];
    if (!rel || !rel.target || !zip.file(rel.target)) continue;
    const slideXml = await zip.file(rel.target).async('string');
    if (/<p:sld[^>]*\sshow="0"/.test(slideXml)) continue;
    slides.push(await parseSlide(zip, rel.target, slideSize));
  }

  let title = '';
  const core = zip.file('docProps/core.xml');
  if (core) title = (desc(xml(await core.async('string')), 'title')[0] || {}).textContent || '';
  return { title: title.trim(), slides: slides.filter(isNotEmpty) };
}

/* ------------------------------------------------------------------- PDF */

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Gagal memuatkan ${src}`));
    document.head.appendChild(s);
  });
}

export async function parsePdf(buffer) {
  if (!window.pdfjsLib) await loadScript(`${PDFJS}/pdf.min.js`);
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const slides = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    // Group text items into lines by their baseline.
    const lines = [];
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const size = Math.hypot(item.transform[2], item.transform[3]);
      let line = lines.find(l => Math.abs(l.y - y) < size * 0.5);
      if (!line) lines.push(line = { y, size, parts: [] });
      line.parts.push({ x: item.transform[4], str: item.str });
      line.size = Math.max(line.size, size);
    }
    lines.sort((a, b) => b.y - a.y);
    const texts = lines.map(l => ({
      size: l.size,
      text: l.parts.sort((a, b) => a.x - b.x).map(p => p.str).join(' ').replace(/\s+/g, ' ').trim(),
    })).filter(l => l.text);

    const slide = emptySlide();
    if (texts.length) {
      const maxSize = Math.max(...texts.map(t => t.size));
      const titleLines = [];
      while (texts.length && texts[0].size >= maxSize * 0.9 && titleLines.length < 3) {
        titleLines.push(texts.shift().text);
      }
      slide.title = escapeHtml(titleLines.join(' '));
      for (const t of texts) {
        const clean = t.text.replace(/^[•\-–▪●◦■*]\s*/, '');
        slide.paragraphs.push(para(escapeHtml(clean), clean, 0));
      }
    }
    slide.isCover = n === 1;
    slides.push(slide);
  }
  return { title: '', slides: slides.filter(isNotEmpty) };
}

/* ------------------------------------------------------------------ Text */

// Plain text / markdown-ish outline:
//   slides separated by a line of "---"
//   first line (or "# ...") is the title, "## ..." a subtitle,
//   "- " / "* " bullets (indent 2 spaces per level), other lines paragraphs.
export function parseText(src) {
  const blocks = src.replace(/\r/g, '').split(/\n\s*-{3,}\s*\n/);
  const slides = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim());
    if (!lines.length) continue;
    const slide = emptySlide();
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const indent = (line.match(/^\s*/)[0].length / 2) | 0;
      const t = line.trim();
      if (!slide.title && !/^[-*•]\s/.test(t)) {
        slide.title = inlineMd(t.replace(/^#\s*/, ''));
      } else if (/^##\s/.test(t) && !slide.subtitle) {
        slide.subtitle = inlineMd(t.replace(/^##\s*/, ''));
      } else {
        const bullet = t.replace(/^[-*•]\s+/, '');
        slide.paragraphs.push(para(inlineMd(bullet), stripMd(bullet), indent));
      }
    }
    slides.push(slide);
  }
  if (slides[0]) slides[0].isCover = true;
  return { title: '', slides };
}

function inlineMd(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
}

function stripMd(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}

function isNotEmpty(s) {
  return s.title || s.subtitle || s.paragraphs.length || s.images.length || s.tables.length;
}

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pptx')) return parsePptx(await file.arrayBuffer());
  if (name.endsWith('.pdf')) return parsePdf(await file.arrayBuffer());
  if (/\.(txt|md|markdown)$/.test(name)) return parseText(await file.text());
  if (name.endsWith('.ppt')) {
    throw new Error('Format .ppt (lama) tidak disokong. Buka dalam PowerPoint dan "Save As" .pptx atau PDF dahulu.');
  }
  throw new Error('Format tidak disokong. Gunakan .pptx, .pdf, .txt atau .md');
}
