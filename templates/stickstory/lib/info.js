// Stick stories information graphics: S.info(kind, o) builds a graphic - most are a whole shot's picture (a BOARD laid
// out in design pixels of a 1920 x 1080 frame, framed by a static camera unless the shot sets one, so pushes and tours
// just work), some sit in a set (phone, document, calendar, stat box) and a few draw over the shot's own picture
// (title, news, cctv). The look, sizes, colours and every timing were measured on the references
// (experiments/stickstory-style/analysis/graphics/NOTES.md); text, names and brands are always our own.
//
// TIMING (every element): at = WHEN (number = exact seconds; a string = a spoken word, starting 2 frames before it),
// word = the same, until = when it ends. PLACE (graphics in a set): pos = [x, y, z] metres, scale, rot (degrees).
// Board graphics return the board's group; group.userData.board = B with B.view(x, y, h) (a camera framing of board
// pixels) and B.world(x, y) (a board pixel in the world). Tours: S.tour(B or group, [{ at, x, y, h }, ...]).
// Contract: KINDS = { kind: (S, o) => Object3D | overlay }, DOCS, make(S, kind, o), S_HELPERS (become S.<name>).
import * as SCREENS from './info/screens.js';
import * as PAPERS from './info/papers.js';
import * as MAPS from './info/maps.js';
import * as SPLIT from './info/split.js';
import { tour as tourOn } from './info/kit.js';
export { PAL, THEMES } from './info/paint.js';

export const KINDS = {
  terminal: SCREENS.terminal, number: SCREENS.number, title: SCREENS.title, endcard: SCREENS.endcard, news: SCREENS.news, cctv: SCREENS.cctv,
  document: PAPERS.document, note: PAPERS.note, calendar: PAPERS.calendar, card: PAPERS.card, statbox: PAPERS.statbox, chart: PAPERS.chart, phone: PAPERS.phone, sign: PAPERS.sign,
  worldmap: MAPS.worldmap, citygrid: MAPS.citygrid, floorplan: MAPS.floorplan, building: MAPS.building, network: MAPS.network, diagram: MAPS.diagram,
  split: SPLIT.split,
};
export const DOCS = {
  terminal: "typed terminal (navy, JetBrains Mono caps 88, 1 char/frame, block cursor blinking 9 off / 14 on, centred block scrolling up in 6 frames): { lines: ['NICE WORK, LEO.', { text, at|word|pause }], at, cps, pause: .9 }",
  number: "big full-screen number / statement with a slow push: { value: '$1,000,000' | { from, to, at|word, preset: 'money'|'counter'|'attempts', frames, land: true (the count ENDS on its word, like the references) }, style: 'cream'|'red'|'green'|'amber'|'white', label: 'UNTIL MIDNIGHT TOMORROW', prefix, suffix, box, push: .08|false }",
  title: "the 'What if you ...?' title over the shot's picture: { lines: ['WHAT IF YOU HAD', '500 IQ?'], style: 'glow'|'outline', pos: 'center'|'left'|[x, y], at|word }",
  endcard: "closing card: night, ring of light, cast, question, engagement row on words: { lines: ['WHAT WOULD YOU DO', 'WITH 500 IQ?'], cast: ['main', 'mom', 'leo'], comment: 'comments', subscribe: 'subscribe', like: 'like', part: 'part', partText: 'PART 2' }",
  news: "broadcast graphics over the shot's picture: { style: 'blue'|'red', headline, sub, ticker, tab: 'BREAKING', strap, channel: 'NEWS', tv: true, at }",
  cctv: "security-camera look over the shot's picture: { style: 'iq' (grey, grain, REC, frame-counting timecode) | 'cam' (colour, CAM label, frame, face box), label, time: '23:41', face: actor }",
  document: "paper with handwritten lines (Kalam, ink #2f366b) fading in 6 frames each, 6 apart, 10 frames ahead of their words: { lines: [{ text, word|at, align, heart }], style: 'note' (lined landscape, desk) | 'page' (title + grey text bars + photo) | 'whiteboard', title, bars, photo, footer, stamp: { text, word, theme }, mark: { line, word } (red marker ring), pos, width, rot, backdrop }",
  note: "sticky note / handwritten note: { text | lines, color: 'yellow'|'pink'|'blue'|'paper', heart, pos, rot, board }",
  calendar: "month page: red header, days, marked days (red marker ring drawing on, crosses): { month: 'MARCH', start: 3 (weekday of the 1st, 0 = Monday), days: 31, ring: { day: 14, word }, cross: [1, 2, 3], note, pos, board }",
  card: "score / test card (aptitude style): { title: 'APTITUDE TEST', label: 'SCORE', value | { from, to, word }, curve: true, marker: .5, stamp: { text: 'EXACTLY AVERAGE', word }, board }",
  statbox: "in-world stat box that scales with the camera: { label: '7 DAYS', value | count spec, prefix: '$', theme, cap: 78, pos, states }",
  chart: "charts on a dark board: { type: 'bell' (bell curve of tiny figures, gold axis, labels on words) | 'line' | 'bars' | 'vote' | 'gauge', ... see papers.js }",
  phone: "a phone with a flat UI screen (in a set or held): { screen: 'call'|'chat'|'notify'|'bank'|'alert'|'map'|'lock', name, sub, messages: [{ text, me, word }], balance, pos, scale, rot }",
  sign: "a card / sign with big words (NOVA WINS. style) on a board or in a set: { lines: ['NOVA', 'WINS.'], colors: ['#2a3f9a', '#b8333a'], paper, rot, board }",
  worldmap: "world map (Natural Earth outline): { style: 'gold'|'steel'|'dots', rect: [x, y, w], pins: [{ place: 'paris'|[lon, lat]|{ x, y }, word }], labels: [{ text, to: place, x, y, word }] (lines draw to the place in 12 f), routes: [{ from, to, word, frames: 9, bend }], nodes: [{ place, word }], stamps: [{ place, text: 'FROZEN', word }], pills: [{ text, x, y, theme, word }], push: { to, word|at, zoom: 2.6, frames: 8 } }",
  citygrid: "street grid map (red on black, dots at crossings): { color, cell: 72, icons: [{ x, y (grid cells) | px: [x, y], label, shape: 'square'|'tower'|'van'|'cam'|'dot', color, word }], cams: { n, at, every }, route: { pts: [[gx, gy], ...], word, dashed }, pills: [{ text, x, y, theme, word }] }",
  floorplan: "office floor plan (amber on black): { outline: [x, y, w, h], walls, desks, exits: [{ x, y, label: 'LIFTS', word }] (red X), dots: [{ x, y, label, color, below }], boxes: [{ x, y, w, h, label: 'STAIRS' }], path: { pts, word }, pills, caption }",
  building: "wireframe tower: { floors: 40, style: 'orange'|'green', highlight: { floor, word }, xs: n, labels: [{ text, floor }], counter: { label, value } }",
  network: "network graph: { nodes: [{ id, x, y, label, icon: 'bank'|'phone'|'person' }], links: [[a, b, word]], tokens: [{ from, to, word }], tags: [{ text, x, y, word }] }",
  diagram: "blueprint line drawings drawing on in ~13 frames on navy: { items: [{ shape: 'head'|'brain'|'box'|'gift'|'arrow'|'circle'|'bulb'|'heart'|'path', x, y, s, word, accent }], glow: { at|word, x, y, r } }",
  split: "two panels with a torn divider, each its own little scene: { left: (S, p) => { ...; return camera spec }, right: ..., at: .46, slide: { word } } (see split.js)",
};
export function make(S, kind, o = {}) {
  const f = KINDS[kind]; if (!f) { console.warn('unknown info ' + kind + ' (kinds: ' + Object.keys(KINDS).join(', ') + ')'); return null; }
  const obj = f(S, o); if (obj?.isObject3D && !obj.parent) S.add(obj); return obj;
}
/** scene helpers: S.split(left, right, o), S.title(lines, o), S.endcard(o), S.tour(board, keys), S.terminal(text, o) */
export const S_HELPERS = {
  split: (S, left, right, o = {}) => make(S, 'split', { ...o, left, right }),
  title: (S, lines, o = {}) => make(S, 'title', { ...o, lines: Array.isArray(lines) ? lines : String(lines).split('\n') }),
  endcard: (S, o = {}) => make(S, 'endcard', o),
  tour: (S, b, keys) => tourOn(S, b?.userData?.board ?? b, keys),
};
