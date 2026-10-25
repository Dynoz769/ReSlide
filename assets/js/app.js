import { parseFile, parseText } from './parsers.js';
import { applyLayouts, LAYOUTS } from './layout.js';
import { buildDeckHTML, THEMES, TRANSITIONS } from './deck.js';

const $ = sel => document.querySelector(sel);

const state = {
  source: null,          // { kind: 'file', file } | { kind: 'text' }
  deck: null,
  overrides: {},
  current: 0,
  theme: 'aurora',
  transition: 'slide',
  html: '',
};

/* ---------------------------------------------------------------- options */

const themesEl = $('#themes');
for (const [key, t] of Object.entries(THEMES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'theme' + (key === state.theme ? ' active' : '');
  b.dataset.theme = key;
  b.innerHTML = `<span class="sw" style="background:${t.bg}">
      <i style="background:${t.accent};width:60px;height:60px;left:-10px;top:-14px"></i>
      <i style="background:${t.accent2};width:50px;height:50px;right:-8px;bottom:-12px"></i>
      <b style="background:linear-gradient(90deg,${t.accent},${t.accent2})"></b>
    </span><span class="nm">${t.name}</span>`;
  b.addEventListener('click', () => {
    state.theme = key;
    themesEl.querySelectorAll('.theme').forEach(x => x.classList.toggle('active', x === b));
    refresh();
  });
  themesEl.appendChild(b);
}

const transitionEl = $('#transition');
transitionEl.innerHTML = Object.entries(TRANSITIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
transitionEl.addEventListener('change', () => { state.transition = transitionEl.value; refresh(); });
$('#autoplay').addEventListener('change', refresh);
$('#particles').addEventListener('change', refresh);

/* ------------------------------------------------------------------ input */

const drop = $('#drop');
const fileInput = $('#file');
const pasteEl = $('#pasteText');
const genBtn = $('#generate');
let activeTab = 'file';

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  activeTab = tab.dataset.tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
  document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== activeTab; });
  updateGenerate();
}));

function setFile(file) {
  if (!file) return;
  state.source = { kind: 'file', file };
  drop.classList.add('has-file');
  $('#dropTitle').textContent = `📄 ${file.name}`;
  status('');
  updateGenerate();
}

fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => setFile(e.dataTransfer.files[0]));
pasteEl.addEventListener('input', updateGenerate);

function updateGenerate() {
  genBtn.disabled = activeTab === 'file' ? !(state.source && state.source.kind === 'file') : !pasteEl.value.trim();
}

function status(msg, err = false) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('err', err);
}

/* --------------------------------------------------------------- generate */

genBtn.addEventListener('click', async () => {
  genBtn.disabled = true;
  genBtn.classList.add('busy');
  status('Membaca kandungan slide…');
  try {
    let deck;
    if (activeTab === 'file') {
      const file = state.source.file;
      deck = await parseFile(file);
      deck.fileName = file.name.replace(/\.[^.]+$/, '');
    } else {
      deck = parseText(pasteEl.value);
      deck.fileName = 'reslide';
    }
    if (!deck.slides.length) throw new Error('Tiada kandungan ditemui dalam fail ini.');
    state.deck = deck;
    state.overrides = {};
    state.current = 0;
    render();
    const imgs = deck.slides.reduce((n, s) => n + s.images.length, 0);
    status(`✓ ${deck.slides.length} slide dijana semula${imgs ? ` · ${imgs} gambar dikekalkan` : ''}.`);
    $('#result').hidden = false;
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    status(err.message || 'Gagal membaca fail.', true);
  } finally {
    genBtn.classList.remove('busy');
    updateGenerate();
  }
});

function options() {
  return {
    theme: state.theme,
    transition: state.transition,
    autoplay: +$('#autoplay').value,
    particles: $('#particles').checked,
  };
}

function refresh() {
  if (state.deck) render();
}

const frame = $('#preview');

function render() {
  applyLayouts(state.deck, state.overrides);
  state.html = buildDeckHTML(state.deck, options());
  const goTo = state.current;
  frame.onload = () => frame.contentWindow.postMessage({ type: 'reslide:go', index: goTo }, '*');
  frame.srcdoc = state.html;
  $('#deckName').textContent = state.deck.title || state.deck.fileName;
  renderOutline();
}

function plain(html) {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

function renderOutline() {
  const list = $('#slides');
  $('#count').textContent = `(${state.deck.slides.length} slide)`;
  const layoutOpts = Object.entries(LAYOUTS);
  list.innerHTML = '';
  state.deck.slides.forEach((s, n) => {
    const li = document.createElement('li');
    li.className = n === state.current ? 'on' : '';
    const label = plain(s.title) || plain(s.paragraphs[0] ? s.paragraphs[0].html : '') ||
      (s.images.length ? `${s.images.length} gambar` : 'Slide');
    const bits = [];
    if (s.paragraphs.length) bits.push(`${s.paragraphs.length} teks`);
    if (s.images.length) bits.push(`${s.images.length} gambar`);
    if (s.tables.length) bits.push('jadual');
    li.innerHTML = `<span class="n">${String(n + 1).padStart(2, '0')}</span><span class="t"></span>
      <span class="meta"><select aria-label="Layout slide ${n + 1}">
        ${layoutOpts.map(([k, v]) => `<option value="${k}"${k === s.layout ? ' selected' : ''}>${v}${k === s.autoLayout ? ' (auto)' : ''}</option>`).join('')}
      </select><span>${bits.join(' · ')}</span></span>`;
    li.querySelector('.t').textContent = label;
    li.addEventListener('click', e => {
      if (e.target.tagName === 'SELECT') return;
      goTo(n);
    });
    li.querySelector('select').addEventListener('change', e => {
      state.overrides[n] = e.target.value;
      state.current = n;
      render();
    });
    list.appendChild(li);
  });
}

function goTo(n) {
  state.current = n;
  frame.contentWindow.postMessage({ type: 'reslide:go', index: n }, '*');
  highlight();
}

function highlight() {
  $('#slides').querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', k === state.current));
}

window.addEventListener('message', e => {
  if (e.source === frame.contentWindow && e.data && e.data.type === 'reslide:slide') {
    state.current = e.data.index;
    highlight();
  }
});

/* ---------------------------------------------------------------- actions */

function blobUrl() {
  return URL.createObjectURL(new Blob([state.html], { type: 'text/html' }));
}

$('#present').addEventListener('click', () => {
  const url = blobUrl();
  const win = window.open(`${url}#${state.current + 1}`, '_blank');
  if (!win) status('Pop-up disekat oleh pelayar. Benarkan pop-up atau gunakan Muat turun HTML.', true);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});

$('#download').addEventListener('click', () => {
  const url = blobUrl();
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.deck.fileName || 'reslide'}-revamp.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

$('#regen').addEventListener('click', () => {
  const keys = Object.keys(THEMES).filter(k => k !== state.theme);
  state.theme = keys[Math.floor(Math.random() * keys.length)];
  const trans = Object.keys(TRANSITIONS);
  state.transition = trans[Math.floor(Math.random() * trans.length)];
  transitionEl.value = state.transition;
  themesEl.querySelectorAll('.theme').forEach(x => x.classList.toggle('active', x.dataset.theme === state.theme));
  refresh();
});
