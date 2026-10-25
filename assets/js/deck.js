// Builds a single, self-contained HTML presentation from the deck model.
// The same output is used for the in-app preview (iframe srcdoc), the
// "Present" tab and the downloaded file, so what you see is what you get.

import { escapeHtml } from './parsers.js';
import { STAT_RE } from './layout.js';

export const THEMES = {
  aurora: {
    name: 'Aurora', dark: true, font: 'Plus Jakarta Sans', display: 'Plus Jakarta Sans',
    bg: '#070b1f', bg2: '#0f1638', text: '#eef1ff', muted: '#a7b0d8',
    accent: '#7c5cff', accent2: '#22d3ee', accent3: '#f472b6',
    card: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.12)',
  },
  neon: {
    name: 'Neon Nights', dark: true, font: 'Space Grotesk', display: 'Space Grotesk',
    bg: '#05050a', bg2: '#11111c', text: '#f5f5ff', muted: '#9a9ab5',
    accent: '#ff2e88', accent2: '#b6ff3b', accent3: '#3bf0ff',
    card: 'rgba(255,255,255,.05)', line: 'rgba(255,255,255,.12)',
  },
  ocean: {
    name: 'Deep Ocean', dark: true, font: 'Outfit', display: 'Outfit',
    bg: '#031a24', bg2: '#06303f', text: '#e9fbff', muted: '#93c3cf',
    accent: '#14e0c4', accent2: '#ffc857', accent3: '#3aa8ff',
    card: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.14)',
  },
  sunset: {
    name: 'Sunset', dark: true, font: 'Poppins', display: 'Poppins',
    bg: '#1a0b1f', bg2: '#2d0f2a', text: '#fff1ea', muted: '#d7a9b4',
    accent: '#ff7a45', accent2: '#ff3d77', accent3: '#ffd166',
    card: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.14)',
  },
  emerald: {
    name: 'Emerald', dark: true, font: 'Sora', display: 'Sora',
    bg: '#04140e', bg2: '#082a1d', text: '#eafff4', muted: '#94c7ad',
    accent: '#2ee59d', accent2: '#d4ff5a', accent3: '#41c7ff',
    card: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.13)',
  },
  minimal: {
    name: 'Minimal Light', dark: false, font: 'Inter', display: 'Inter',
    bg: '#f7f6f2', bg2: '#ecebe4', text: '#16161d', muted: '#5f6070',
    accent: '#4f46e5', accent2: '#0ea5e9', accent3: '#f43f5e',
    card: 'rgba(255,255,255,.75)', line: 'rgba(20,20,40,.1)',
  },
  corporate: {
    name: 'Corporate', dark: false, font: 'Manrope', display: 'Manrope',
    bg: '#f3f6fb', bg2: '#e3eaf6', text: '#0b1b33', muted: '#4a5b78',
    accent: '#1d4ed8', accent2: '#0891b2', accent3: '#f59e0b',
    card: 'rgba(255,255,255,.85)', line: 'rgba(11,27,51,.1)',
  },
};

export const TRANSITIONS = {
  slide: 'Tolak (slide)',
  zoom: 'Zum',
  flip: 'Pusing 3D',
  fade: 'Pudar',
};

const pad = n => String(n).padStart(2, '0');
const i = n => `style="--i:${n}"`;

/* ---------------------------------------------------------------- layouts */

function header(s, startI = 0) {
  if (!s.title) return '';
  return `<header class="hd">
      <h2 class="title" data-split>${s.title}</h2>
      <div class="bar a line" ${i(startI + 2)}></div>
      ${s.subtitle ? `<p class="lead a up" ${i(startI + 3)}>${s.subtitle}</p>` : ''}
    </header>`;
}

function list(ps, start = 3) {
  return `<ul class="list">${ps.map((p, n) =>
    `<li class="item lv${Math.min(p.level, 3)} a left" ${i(start + n)}><span class="dot"></span><span class="tx">${p.html}</span></li>`
  ).join('')}</ul>`;
}

function media(images, start) {
  const imgs = images.map((im, n) =>
    `<figure class="ph a reveal" ${i(start + n)}><img src="${im.src}" alt=""></figure>`).join('');
  return `<div class="media m${Math.min(images.length, 4)}">${imgs}</div>`;
}

const RENDER = {
  cover(s) {
    const extra = s.paragraphs.map((p, n) => `<p class="sub small a up" ${i(5 + n)}>${p.html}</p>`).join('');
    return `<div class="rings a zoom" ${i(0)}><span></span><span></span><span></span></div>
    <div class="inner center">
      ${s.title ? `<h1 class="t-cover" data-split>${s.title}</h1>` : ''}
      <div class="bar wide a line" ${i(3)}></div>
      ${s.subtitle ? `<p class="sub a up" ${i(4)}>${s.subtitle}</p>` : ''}
      ${extra}
      ${s.images.length ? media(s.images, 6) : ''}
    </div>`;
  },

  section(s, ctx) {
    return `<div class="inner center-left">
      <div class="big-num a reveal" ${i(0)}>${pad(ctx.section)}</div>
      ${s.title ? `<h2 class="t-section" data-split>${s.title}</h2>` : ''}
      <div class="bar wide a line" ${i(3)}></div>
      ${s.subtitle ? `<p class="sub a up" ${i(4)}>${s.subtitle}</p>` : ''}
    </div>`;
  },

  bullets(s) {
    const many = s.paragraphs.length > 7 && s.paragraphs.every(p => p.text.length < 70);
    return `<div class="inner">${header(s)}
      <div class="body fit${many ? ' two-col' : ''}">${list(s.paragraphs)}</div>
    </div>`;
  },

  cards(s) {
    const cards = s.paragraphs.map((p, n) => `<div class="card a pop" ${i(3 + n)}>
        <div class="card-num">${pad(n + 1)}</div>
        <div class="card-tx">${p.html}</div>
      </div>`).join('');
    return `<div class="inner">${header(s)}
      <div class="body fit"><div class="grid g${s.paragraphs.length}">${cards}</div></div>
    </div>`;
  },

  stats(s) {
    const cards = s.paragraphs.map((p, n) => {
      const m = p.text.match(STAT_RE);
      const [, pre, num, unit, rest] = m;
      return `<div class="stat a pop" ${i(3 + n)}>
        <div class="stat-num">${escapeHtml(pre)}<span class="count" data-to="${escapeHtml(num)}">${escapeHtml(num)}</span>${escapeHtml(unit)}</div>
        <div class="stat-tx">${escapeHtml(rest.trim())}</div>
      </div>`;
    }).join('');
    return `<div class="inner">${header(s)}
      <div class="body fit"><div class="grid g${s.paragraphs.length} stats">${cards}</div></div>
    </div>`;
  },

  timeline(s) {
    const steps = s.paragraphs.map((p, n) => `<div class="step a up" ${i(4 + n)}>
        <div class="node"><span>${n + 1}</span></div>
        <div class="step-tx">${p.html}</div>
      </div>`).join('');
    return `<div class="inner">${header(s)}
      <div class="body fit"><div class="timeline">
        <div class="track a line" ${i(3)}></div>${steps}
      </div></div>
    </div>`;
  },

  split(s, ctx) {
    const flip = ctx.index % 2 === 1;
    return `<div class="inner split${flip ? ' flip' : ''}">
      <div class="col-text">${header(s)}
        <div class="body fit">${list(s.paragraphs)}</div>
      </div>
      <div class="col-media">${media(s.images, 2)}</div>
    </div>`;
  },

  gallery(s) {
    return `<div class="inner">${header(s)}
      <div class="body gallery-wrap">${media(s.images, 2)}</div>
      ${s.paragraphs.length ? `<div class="caption">${list(s.paragraphs, 4)}</div>` : ''}
    </div>`;
  },

  table(s) {
    const tables = s.tables.map(rows => {
      const [head, ...body] = rows;
      return `<table class="tbl">
        <thead><tr class="a up" ${i(3)}>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${body.map((r, n) => `<tr class="a left" ${i(4 + n)}>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    }).join('');
    const extra = s.paragraphs.length ? list(s.paragraphs, 4 + s.tables[0].length) : '';
    return `<div class="inner">${header(s)}
      <div class="body fit">${tables}${extra}${s.images.length ? media(s.images, 6) : ''}</div>
    </div>`;
  },

  quote(s) {
    return `<div class="inner center">
      <div class="qmark a zoom" ${i(0)}>&ldquo;</div>
      ${s.title ? `<p class="q-title a up" ${i(1)}>${s.title}</p>` : ''}
      <div class="fit q-fit">${s.paragraphs.map(p => `<blockquote class="quote" data-split>${p.html}</blockquote>`).join('')}</div>
      <div class="bar a line" ${i(6)}></div>
      ${s.subtitle ? `<p class="sub a up" ${i(7)}>${s.subtitle}</p>` : ''}
    </div>`;
  },

  text(s) {
    return `<div class="inner">${header(s)}
      <div class="body fit prose">${s.paragraphs.map((p, n) =>
        `<p class="a up lv${Math.min(p.level, 3)}" ${i(3 + n)}>${p.html}</p>`).join('')}</div>
    </div>`;
  },
};

function renderSlide(s, ctx) {
  const fn = RENDER[s.layout] || RENDER.bullets;
  return `<section class="slide l-${s.layout}" data-index="${ctx.index}">${fn(s, ctx)}</section>`;
}

/* -------------------------------------------------------------------- css */

function themeVars(t) {
  return `:root{--bg:${t.bg};--bg2:${t.bg2};--text:${t.text};--muted:${t.muted};
  --accent:${t.accent};--accent2:${t.accent2};--accent3:${t.accent3};
  --card:${t.card};--line:${t.line};--font:'${t.font}',system-ui,sans-serif;
  --display:'${t.display}',system-ui,sans-serif;--shadow:${t.dark ? '0 30px 80px rgba(0,0,0,.45)' : '0 30px 70px rgba(30,40,80,.14)'};
  --blob-op:${t.dark ? '.55' : '.35'};--grid-op:${t.dark ? '.06' : '.05'}}`;
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);overflow:hidden}
body{display:grid;place-items:center;-webkit-font-smoothing:antialiased}
.stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center;
  transform:translate(-50%,-50%) scale(var(--scale,1));overflow:hidden;background:var(--bg);perspective:2400px}
strong{font-weight:800;color:var(--accent2)}
em{font-style:italic}

/* animated background */
.bg{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 120% at 0% 0%,var(--bg2),var(--bg) 60%)}
.blob{position:absolute;border-radius:50%;filter:blur(110px);opacity:var(--blob-op);
  transition:transform 1.6s cubic-bezier(.6,0,.2,1);will-change:transform}
.blob.b1{width:900px;height:900px;background:var(--accent);left:-200px;top:-300px;
  transform:translate(calc(var(--k,0)*90px),calc(var(--k,0)*40px));animation:float1 18s ease-in-out infinite alternate}
.blob.b2{width:780px;height:780px;background:var(--accent2);right:-260px;bottom:-280px;
  transform:translate(calc(var(--k,0)*-70px),calc(var(--k,0)*-30px));animation:float2 22s ease-in-out infinite alternate}
.blob.b3{width:520px;height:520px;background:var(--accent3);left:45%;top:55%;opacity:calc(var(--blob-op)*.6);
  animation:float3 26s ease-in-out infinite alternate}
@keyframes float1{to{margin-left:220px;margin-top:140px}}
@keyframes float2{to{margin-right:180px;margin-bottom:200px}}
@keyframes float3{to{margin-left:-500px;margin-top:-380px}}
.grid-bg{position:absolute;inset:-2px;opacity:var(--grid-op);
  background-image:linear-gradient(var(--text) 1px,transparent 1px),linear-gradient(90deg,var(--text) 1px,transparent 1px);
  background-size:80px 80px;mask-image:radial-gradient(circle at 50% 50%,#000 20%,transparent 75%);
  -webkit-mask-image:radial-gradient(circle at 50% 50%,#000 20%,transparent 75%)}
canvas.particles{position:absolute;inset:0;width:100%;height:100%}

/* slides + transitions */
.slide{position:absolute;inset:0;opacity:0;visibility:hidden;--fs:1;
  transition:transform 1s cubic-bezier(.7,0,.2,1),opacity .8s ease,visibility 0s linear 1s;backface-visibility:hidden}
.slide.is-active{opacity:1;visibility:visible;transform:none;transition-delay:0s,0s,0s}
[data-transition=slide] .slide{opacity:1}
[data-transition=slide] .slide.is-past{transform:translateX(-100%)}
[data-transition=slide] .slide.is-future{transform:translateX(100%)}
[data-transition=zoom] .slide.is-past{transform:scale(1.35);opacity:0}
[data-transition=zoom] .slide.is-future{transform:scale(.75)}
[data-transition=flip] .slide.is-past{transform:translateX(-35%) rotateY(65deg) scale(.85)}
[data-transition=flip] .slide.is-future{transform:translateX(35%) rotateY(-65deg) scale(.85)}
[data-transition=fade] .slide{transition:opacity 1s ease,visibility 0s linear 1s}

/* entrance animations */
.a{opacity:0}
.is-active .a{animation:var(--fx) 1s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i,0)*120ms + 300ms)}
.a.up{--fx:fxUp}.a.left{--fx:fxLeft}.a.zoom{--fx:fxZoom}.a.pop{--fx:fxPop}.a.reveal{--fx:fxReveal}
.a.line{--fx:fxLine;transform-origin:left center}
@keyframes fxUp{from{opacity:0;transform:translateY(60px);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
@keyframes fxLeft{from{opacity:0;transform:translateX(-70px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes fxZoom{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes fxPop{0%{opacity:0;transform:translateY(80px) scale(.85) rotateX(25deg)}100%{opacity:1;transform:none}}
@keyframes fxReveal{from{opacity:1;clip-path:inset(0 100% 0 0)}to{opacity:1;clip-path:inset(0 0 0 0)}}
@keyframes fxLine{from{opacity:1;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
.wi{display:inline-block;opacity:0;transform:translateY(110%) rotate(6deg)}
.is-active .wi{animation:fxWord .9s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--w)*55ms + 120ms)}
@keyframes fxWord{to{opacity:1;transform:none}}
.w{display:inline-block;white-space:pre;overflow:hidden;vertical-align:top;padding-bottom:.08em;margin-bottom:-.08em}

/* layout primitives */
.inner{position:absolute;inset:0;padding:110px 150px 120px;display:flex;flex-direction:column}
.inner.center{align-items:center;justify-content:center;text-align:center}
.inner.center-left{justify-content:center}
.hd{margin-bottom:calc(var(--fs)*44px);flex:none}
.title{font-family:var(--display);font-weight:800;font-size:calc(var(--fs)*76px);line-height:1.08;letter-spacing:-.025em}
.bar{height:8px;width:140px;border-radius:8px;margin-top:28px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.bar.wide{width:260px}
.center .bar{margin-left:auto;margin-right:auto}
.lead{margin-top:24px;font-size:calc(var(--fs)*34px);color:var(--muted);line-height:1.4}
.body{flex:1;min-height:0;font-size:calc(var(--fs)*38px);line-height:1.45}

.t-cover{font-family:var(--display);font-weight:800;font-size:calc(var(--fs)*124px);line-height:1.02;letter-spacing:-.035em;max-width:1500px}
.sub{margin-top:36px;font-size:calc(var(--fs)*42px);color:var(--muted);max-width:1400px;line-height:1.4}
.sub.small{margin-top:18px;font-size:calc(var(--fs)*32px)}
.rings{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none}
.rings span{position:absolute;left:50%;top:50%;border:2px solid var(--line);border-radius:50%;transform:translate(-50%,-50%);animation:spin 40s linear infinite}
.rings span:nth-child(1){width:900px;height:900px;border-top-color:var(--accent)}
.rings span:nth-child(2){width:1250px;height:1250px;border-right-color:var(--accent2);animation-duration:60s;animation-direction:reverse}
.rings span:nth-child(3){width:1600px;height:1600px;border-bottom-color:var(--accent3);animation-duration:90s}
@keyframes spin{to{transform:translate(-50%,-50%) rotate(360deg)}}

.big-num{font-family:var(--display);font-weight:800;font-size:320px;line-height:.9;letter-spacing:-.05em;
  color:transparent;-webkit-text-stroke:3px var(--accent);opacity:.9;margin-bottom:10px}
.t-section{font-family:var(--display);font-weight:800;font-size:calc(var(--fs)*110px);line-height:1.04;letter-spacing:-.03em;max-width:1500px}

.list{list-style:none;display:flex;flex-direction:column;gap:calc(var(--fs)*22px)}
.two-col .list{display:grid;grid-template-columns:1fr 1fr;column-gap:60px}
.item{display:flex;gap:28px;align-items:flex-start;padding:calc(var(--fs)*20px) calc(var(--fs)*30px);border-radius:22px;
  background:var(--card);border:1px solid var(--line);backdrop-filter:blur(12px);box-shadow:var(--shadow)}
.item .dot{flex:none;width:18px;height:18px;margin-top:calc(var(--fs)*20px);border-radius:6px;transform:rotate(45deg);
  background:linear-gradient(135deg,var(--accent),var(--accent2));box-shadow:0 0 24px var(--accent)}
.item.lv1,.item.lv2,.item.lv3{backdrop-filter:none}
.item.lv1{margin-left:70px;font-size:.86em;background:transparent;box-shadow:none;border-color:transparent;padding-top:0;padding-bottom:0}
.item.lv2,.item.lv3{margin-left:140px;font-size:.78em;background:transparent;box-shadow:none;border-color:transparent;padding-top:0;padding-bottom:0}
.item.lv1 .dot,.item.lv2 .dot,.item.lv3 .dot{width:12px;height:12px;border-radius:50%;box-shadow:none;background:var(--accent2);margin-top:calc(var(--fs)*22px)}

.grid{display:grid;gap:40px;height:100%;align-content:center}
.grid.g2{grid-template-columns:repeat(2,1fr)}.grid.g3{grid-template-columns:repeat(3,1fr)}
.grid.g4{grid-template-columns:repeat(2,1fr)}.grid.g5,.grid.g6{grid-template-columns:repeat(3,1fr)}
.card,.stat{position:relative;padding:calc(var(--fs)*48px);border-radius:32px;background:var(--card);border:1px solid var(--line);
  box-shadow:var(--shadow);backdrop-filter:blur(14px);overflow:hidden}
.card::before,.stat::before{content:"";position:absolute;inset:0 0 auto 0;height:6px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3))}
.card-num{font-family:var(--display);font-weight:800;font-size:72px;line-height:1;margin-bottom:24px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.card-tx{font-size:calc(var(--fs)*38px);line-height:1.4}
.stats .stat{text-align:center;display:flex;flex-direction:column;justify-content:center}
.stat-num{font-family:var(--display);font-weight:800;font-size:calc(var(--fs)*120px);line-height:1;letter-spacing:-.03em;
  background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.stat-tx{margin-top:26px;font-size:calc(var(--fs)*34px);color:var(--muted);line-height:1.35}

.timeline{position:relative;display:flex;gap:36px;height:100%;align-items:flex-start;padding-top:60px}
.timeline .track{position:absolute;left:0;right:0;top:104px;height:6px;border-radius:6px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3))}
.step{flex:1;position:relative;display:flex;flex-direction:column;align-items:flex-start}
.node{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:var(--bg);border:6px solid var(--accent);
  box-shadow:0 0 0 12px var(--card),0 0 50px var(--accent);font-family:var(--display);font-weight:800;font-size:40px;margin-bottom:40px;position:relative;z-index:1}
.step-tx{font-size:calc(var(--fs)*34px);line-height:1.4;padding:calc(var(--fs)*28px);border-radius:24px;background:var(--card);border:1px solid var(--line);width:100%}

.split{flex-direction:row;gap:90px;align-items:stretch}
.split.flip{flex-direction:row-reverse}
.col-text{flex:1.1;display:flex;flex-direction:column;min-width:0;justify-content:center}
.col-text .body{flex:0 1 auto;min-height:0;overflow:hidden}
.col-media{flex:1;display:flex;align-items:center;min-width:0}
.media{width:100%;height:100%;display:grid;gap:26px}
.media.m1{grid-template-rows:1fr}
.split .media.m1{height:auto;max-height:100%}
.split .media.m1 .ph img{max-height:760px}
.media.m2{grid-template-columns:1fr 1fr}
.media.m3{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}.media.m3 .ph:first-child{grid-row:span 2}
.media.m4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.ph{position:relative;border-radius:30px;overflow:hidden;background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow);
  display:grid;place-items:center;min-height:0;padding:14px}
.ph img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:18px;display:block}
.is-active .ph img{animation:kb 14s ease-out both}
@keyframes kb{from{transform:scale(1.12)}to{transform:scale(1)}}
.gallery-wrap{display:flex}
.gallery-wrap .media{max-height:100%}
.l-cover .media{height:300px;margin-top:40px;width:auto;grid-auto-flow:column}
.caption{flex:none;margin-top:30px;font-size:calc(var(--fs)*30px)}

.tbl{width:100%;border-collapse:separate;border-spacing:0 12px;font-size:calc(var(--fs)*32px)}
.tbl th{text-align:left;padding:calc(var(--fs)*22px) 30px;font-weight:700;color:#fff;background:var(--accent)}
.tbl th:first-child{border-radius:18px 0 0 18px}.tbl th:last-child{border-radius:0 18px 18px 0}
.tbl td{padding:calc(var(--fs)*20px) 30px;background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.tbl td:first-child{border-radius:18px 0 0 18px;border-left:1px solid var(--line);font-weight:700}
.tbl td:last-child{border-radius:0 18px 18px 0;border-right:1px solid var(--line)}
.tbl+.list{margin-top:30px}

.qmark{font-family:Georgia,serif;font-size:420px;line-height:.6;height:200px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.q-title{font-size:calc(var(--fs)*34px);color:var(--accent2);text-transform:uppercase;letter-spacing:.14em;font-weight:700;margin-bottom:30px}
.q-fit{max-height:600px;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}
.quote{font-family:var(--display);font-size:calc(var(--fs)*64px);line-height:1.3;font-weight:600;max-width:1500px;letter-spacing:-.01em}

.prose p{margin-bottom:calc(var(--fs)*30px);padding-left:36px;border-left:6px solid var(--accent);max-width:1500px}
.prose p.lv1,.prose p.lv2,.prose p.lv3{margin-left:60px;border-left-color:var(--accent2)}

/* chrome */
.progress{position:absolute;left:0;top:0;height:8px;width:100%;z-index:10;background:var(--line)}
.progress i{display:block;height:100%;width:var(--p,0%);background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent3));
  transition:width .9s cubic-bezier(.7,0,.2,1);box-shadow:0 0 20px var(--accent)}
.hud{position:absolute;right:60px;bottom:44px;z-index:10;display:flex;align-items:center;gap:18px;font-size:26px;color:var(--muted);font-weight:600}
.hud button{width:64px;height:64px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--text);
  font-size:28px;cursor:pointer;backdrop-filter:blur(10px);transition:transform .2s,background .2s}
.hud button:hover{transform:scale(1.08);background:var(--accent);color:#fff}
.hud .num b{color:var(--text);font-size:34px}
.brand{position:absolute;left:60px;bottom:52px;z-index:10;font-size:24px;color:var(--muted);letter-spacing:.08em;max-width:900px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hint{position:absolute;left:50%;bottom:48px;transform:translateX(-50%);z-index:10;font-size:22px;color:var(--muted);
  padding:12px 26px;border-radius:40px;background:var(--card);border:1px solid var(--line);transition:opacity .6s}
.hint.hide{opacity:0}
body.embed .hint{display:none}

@media (prefers-reduced-motion:reduce){
  .a,.wi{animation:none!important;opacity:1!important;transform:none!important;clip-path:none!important}
  .slide{transition:opacity .3s,visibility 0s linear .3s!important}
  .blob,.rings span,.ph img{animation:none!important}
}
@media print{
  html,body{overflow:visible;height:auto}
  .stage{position:relative;left:0;top:0;transform:none;overflow:visible;height:auto}
  .bg,.progress,.hud,.hint,canvas{display:none}
  .slide{position:relative;opacity:1;visibility:visible;transform:none!important;height:1080px;page-break-after:always;
    background:var(--bg)}
  .a,.wi{opacity:1!important;animation:none!important;transform:none!important;clip-path:none!important}
  @page{size:1920px 1080px;margin:0}
}
`;

/* ---------------------------------------------------------------- runtime */

// Serialised with Function#toString into the exported file; keep it self-contained.
function runtime() {
  const stage = document.querySelector('.stage');
  const slides = [...document.querySelectorAll('.slide')];
  const bar = document.querySelector('.progress i');
  const num = document.querySelector('.hud .num b');
  const hint = document.querySelector('.hint');
  const bgEl = document.querySelector('.bg');
  const autoplay = +document.body.dataset.autoplay || 0;
  let cur = -1;
  let timer = null;

  if (window.self !== window.top) document.body.classList.add('embed');

  function scale() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty('--scale', s);
  }
  window.addEventListener('resize', scale);
  scale();

  // Split titles into words so they can rise in one by one.
  let w = 0;
  function splitWords(el) {
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const outer = document.createElement('span');
          outer.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'wi';
          inner.style.setProperty('--w', w++);
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        splitWords(node);
      }
    }
  }
  slides.forEach(s => { w = 0; s.querySelectorAll('[data-split]').forEach(splitWords); });

  // Shrink text that would overflow its slide, so no content is ever cut.
  function fit(slide) {
    const inner = slide.querySelector('.inner');
    let fs = 1;
    slide.style.setProperty('--fs', fs);
    const over = () => inner.scrollHeight > inner.clientHeight + 12 ||
      [...slide.querySelectorAll('.fit')].some(f => f.scrollHeight > f.clientHeight + 12);
    while (over() && fs > 0.42) {
      fs = Math.round((fs - 0.04) * 100) / 100;
      slide.style.setProperty('--fs', fs);
    }
  }
  const fitAll = () => slides.forEach(fit);
  fitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  window.addEventListener('load', fitAll);

  function countUp(slide) {
    slide.querySelectorAll('.count').forEach(el => {
      const raw = el.dataset.to;
      const comma = /\d,\d{3}/.test(raw);
      const clean = comma ? raw.replace(/,/g, '') : raw.replace(',', '.');
      const target = parseFloat(clean);
      if (!isFinite(target)) return;
      const dec = (clean.split('.')[1] || '').length;
      const t0 = performance.now() + 450;
      const dur = 1600;
      const step = now => {
        const p = Math.min(1, Math.max(0, (now - t0) / dur));
        const v = target * (1 - Math.pow(1 - p, 4));
        el.textContent = p >= 1 ? raw : (comma
          ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
          : v.toFixed(dec));
        if (p < 1 && slide.classList.contains('is-active')) requestAnimationFrame(step);
        else el.textContent = raw;
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }

  function go(n, silent) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === cur) return;
    cur = n;
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === n);
      s.classList.toggle('is-past', k < n);
      s.classList.toggle('is-future', k > n);
    });
    countUp(slides[n]);
    bar.style.setProperty('--p', `${((n + 1) / slides.length) * 100}%`);
    num.textContent = String(n + 1).padStart(2, '0');
    bgEl.style.setProperty('--k', n % 2 ? 1 : (n % 3 ? -1 : 0));
    if (n > 0 && hint) hint.classList.add('hide');
    if (!silent && window.parent !== window) window.parent.postMessage({ type: 'reslide:slide', index: n }, '*');
    try { history.replaceState(null, '', `#${n + 1}`); } catch (e) { /* srcdoc / file */ }
    if (autoplay) {
      clearTimeout(timer);
      if (n < slides.length - 1) timer = setTimeout(() => go(cur + 1), autoplay * 1000);
    }
  }
  const next = () => go(cur + 1);
  const prev = () => go(cur - 1);

  document.addEventListener('keydown', e => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    }
  });
  document.querySelector('.hud .next').addEventListener('click', e => { e.stopPropagation(); next(); });
  document.querySelector('.hud .prev').addEventListener('click', e => { e.stopPropagation(); prev(); });
  stage.addEventListener('click', e => {
    if (e.target.closest('.hud') || window.getSelection().toString()) return;
    (e.clientX < window.innerWidth * 0.25 ? prev : next)();
  });
  let tx = null;
  document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    tx = null;
  });
  window.addEventListener('message', e => {
    if (e.data && e.data.type === 'reslide:go') go(e.data.index, true);
  });

  // Floating particle network behind the slides.
  const cvs = document.querySelector('canvas.particles');
  if (cvs && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const ctx = cvs.getContext('2d');
    cvs.width = 1920; cvs.height = 1080;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim();
    const pts = Array.from({ length: 70 }, () => ({
      x: Math.random() * 1920, y: Math.random() * 1080,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: Math.random() * 2.5 + 1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, 1920, 1080);
      ctx.fillStyle = color; ctx.strokeStyle = color;
      for (const p of pts) {
        p.x = (p.x + p.vx + 1920) % 1920; p.y = (p.y + p.vy + 1080) % 1080;
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
          if (d < 180) {
            ctx.globalAlpha = (1 - d / 180) * 0.18;
            ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };
    draw();
  }

  const start = parseInt((location.hash || '').slice(1), 10);
  requestAnimationFrame(() => { if (cur < 0) go(isFinite(start) ? start - 1 : 0, true); });
}

/* ------------------------------------------------------------------ build */

export function buildDeckHTML(deck, opts = {}) {
  const theme = THEMES[opts.theme] || THEMES.aurora;
  const transition = TRANSITIONS[opts.transition] ? opts.transition : 'slide';
  let section = 0;
  const slides = deck.slides.map((s, index) => {
    if (s.layout === 'section') section++;
    return renderSlide(s, { index, section });
  }).join('\n');
  const title = escapeHtml(deck.title || deck.fileName || 'ReSlide');
  const fonts = [...new Set([theme.font, theme.display])]
    .map(f => `family=${f.replace(/ /g, '+')}:ital,wght@0,400;0,600;0,700;0,800;1,400`).join('&');

  return `<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="ReSlide">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap">
<style>${themeVars(theme)}${CSS}</style>
</head>
<body data-transition="${transition}" data-autoplay="${+opts.autoplay || 0}">
<div class="stage">
  <div class="bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="grid-bg"></div>
    ${opts.particles === false ? '' : '<canvas class="particles"></canvas>'}</div>
  <div class="progress"><i></i></div>
${slides}
  <div class="brand">${escapeHtml(deck.title || '')}</div>
  <div class="hint">← → untuk navigasi · F skrin penuh</div>
  <div class="hud"><button class="prev" aria-label="Sebelum">‹</button>
    <span class="num"><b>01</b> / ${pad(deck.slides.length)}</span>
    <button class="next" aria-label="Seterusnya">›</button></div>
</div>
<script>(${runtime.toString()})();<\/script>
</body>
</html>`;
}
