// The project's main character: character(p) in models.js draws this one. Toon Studio writes this file when the
// project is made (the user's default character, a random new one, or one Claude designed in a character lab).
//   name   what the narration and storyboard call them
//   look   traits drawn by the rig in models.js (TRAITS lists every hair, top and extra it can draw)
//   parts  optional functions for what the traits can't draw (see the skill's references/characters.md); may import
//          only from './engine.js'
// Keep this character consistent across the whole video: don't redesign it in a scene. Other people: character(p, { look }).
export const name = 'Mo';
export const about = 'The style\'s original character: navy side-swept bob with a top bun, mustard sweater, navy trousers.';
export const look = {
  skin: '#f6b48c', skinShade: '#e8986f',
  hair: { style: 'bob', color: '#26306e', hi: '#3a46a0', bun: true },
  top: { style: 'sweater', color: '#ffb51f', dark: '#e39a10' },
  pants: '#2b3990', shoes: '#1b1238', extras: [], build: { width: 1, head: 1, legs: 1 },
};
export const parts = {};
