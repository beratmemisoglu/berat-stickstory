// The built-in cast: 20 original base characters (our own designs). Every one is data for lib/rig.js: body type, skin,
// hair, outfit, accessories and the face's placement. Scenes pick one by id (`S.char('milo')`), recast it with overrides
// (`S.char('milo', { look: { top: { color: '#cc3333' } } })`: 6-digit colours) or dress it for the topic (`outfit: 'astronaut'`). The project's MAIN
// character (settings.characters.main, picked in the app) is `S.char('main')`.
// Units are metres: a grown-up is ~1.62 m to the top of the head (head diameter ~0.49 m: a big-headed cartoon).
// white: the classic white-headed cartoon look (a project palette: settings.characters.palette = 'white', or one character:
// look: { skin: 'white' }); never pure #fff so the sphere's shading still reads
export const SKIN = { pale: '#f8e2cc', light: '#f1d3b3', warm: '#e8bd93', tan: '#d29b6c', brown: '#a66d43', deep: '#6e4529', white: '#f4f3ef' };
// Measured on the references: head : torso : leg : limb thickness = 1 : 1.2-1.4 : 1.2-1.3 : ~0.05-0.07 (head diameter = 1).
// The torso is a bean: hip = the widest radius low on the belly, waist = the middle, chest = the radius where the round
// shoulder dome starts (a pear when hip > chest, a V when chest > hip). leg = floor to the torso's bottom, arm = shoulder
// to wrist, limb = arm radius (legs are 8 % thicker). waistV = the trouser line as a fraction of the torso height.
export const BODY = {
  //          head(r)  torso h  hip   waist  chest  limb    leg   arm   waistV
  regular:  { head: .245, torso: .6,  hip: .168, waist: .158, chest: .148, limb: .0115, leg: .6,  arm: .5,  waistV: .3 },
  slim:     { head: .236, torso: .64, hip: .138, waist: .128, chest: .128, limb: .0105, leg: .68, arm: .54, waistV: .3 },
  round:    { head: .25,  torso: .6,  hip: .232, waist: .236, chest: .198, limb: .013,  leg: .5,  arm: .48, waistV: .26 },
  strong:   { head: .24,  torso: .64, hip: .168, waist: .182, chest: .214, limb: .0145, leg: .62, arm: .56, waistV: .28 },
  kid:      { head: .228, torso: .38, hip: .122, waist: .116, chest: .11,  limb: .0098, leg: .34, arm: .34, waistV: .3 },
  elder:    { head: .24,  torso: .56, hip: .17,  waist: .166, chest: .142, limb: .011,  leg: .54, arm: .48, waistV: .3, stoop: .12 },
};
// top.type: tee, tank, sweater, cardigan, vest, hoodie, flannel, blouse, uniform, overalls, suit, puffer, scrubs, jacket,
//   leather, chef, labcoat, dress, shirt-open, safari, tunic, spacesuit, wetsuit, hazmat, armor, robe, flightsuit, sailor
// top options: color, color2 (pattern), pattern (stripes | plaid | flowers | dots), under (shirt under an opening), tie,
//   badge, vest (hi-vis), trim, belt, collar
// bottom.type: pants, shorts, skirt, legs (tights / bare: color null = skin), or the top's suit type (one-piece)
// hat: cap, cap-back, beanie, officer, chef, hardhat, pith, helmet, dive-mask, hazmat-hood, helm, nemes, pilot-cap, sailor
// acc: glasses-round, glasses, sunglasses, mustache, beard, stubble, freckles, backpack, backpack-tank, air-tank, scarf
// hair.type: sweep, short, buzz, messy, spiky, slick, curly, tuft, horseshoe, bob, long, wavy, bun, ponytail, pigtails,
//   puffs, bald
export const CAST = {
  milo:   { name: 'Milo', role: 'everyman', body: 'regular', skin: 'light', hair: { type: 'sweep', color: '#5b3a24' }, top: { type: 'tee', color: '#2f9c95' }, bottom: { type: 'pants', color: '#2b3a52' }, shoes: '#f2f2f2' },
  juno:   { name: 'Juno', role: 'everywoman', body: 'regular', skin: 'warm', hair: { type: 'bun', color: '#2a1d17' }, top: { type: 'sweater', color: '#f2b632' }, bottom: { type: 'pants', color: '#33415c' }, shoes: '#7a3b2a' },
  dex:    { name: 'Dex', role: 'scientist', body: 'slim', skin: 'pale', hair: { type: 'messy', color: '#c9a66b' }, top: { type: 'labcoat', color: '#f7f7f2', under: '#7da7d9', tie: '#2f4f8f' }, bottom: { type: 'pants', color: '#4a4f57' }, shoes: '#2b2b2b', acc: ['glasses-round'] },
  bea:    { name: 'Bea', role: 'kid', body: 'kid', skin: 'tan', hair: { type: 'pigtails', color: '#2a1a12' }, top: { type: 'dress', color: '#e2432f', collar: '#ffffff' }, bottom: { type: 'legs', color: null }, shoes: '#f6c945' },
  otis:   { name: 'Otis', role: 'big guy', body: 'round', skin: 'warm', hair: { type: 'short', color: '#3b2416' }, top: { type: 'flannel', color: '#b23a2e', pattern: 'plaid' }, bottom: { type: 'pants', color: '#3d5a80' }, shoes: '#5a3a22', acc: ['beard'] },
  rose:   { name: 'Nana Rose', role: 'grandma', body: 'elder', skin: 'light', hair: { type: 'bun', color: '#dcdcdc' }, top: { type: 'cardigan', color: '#9b6bb3', under: '#f3e9da' }, bottom: { type: 'skirt', color: '#5d4a6b' }, shoes: '#4a3428', acc: ['glasses-round'] },
  walt:   { name: 'Walt', role: 'grandpa', body: 'elder', skin: 'pale', hair: { type: 'horseshoe', color: '#e6e6e6' }, top: { type: 'vest', color: '#7a8b4f', under: '#f1eee4' }, bottom: { type: 'pants', color: '#6b5a48' }, shoes: '#3b2a20', acc: ['mustache'] },
  kai:    { name: 'Kai', role: 'student', body: 'regular', skin: 'brown', hair: { type: 'curly', color: '#1c140f' }, top: { type: 'hoodie', color: '#4f6bd8' }, bottom: { type: 'pants', color: '#2d2d33' }, shoes: '#e9e9e9' },
  priya:  { name: 'Priya', role: 'professional', body: 'slim', skin: 'tan', hair: { type: 'long', color: '#17110d' }, top: { type: 'blouse', color: '#2e9e6b' }, bottom: { type: 'pants', color: '#232833' }, shoes: '#1d1d1d' },
  sam:    { name: 'Sam', role: 'officer', body: 'strong', skin: 'deep', hair: { type: 'buzz', color: '#120d0a' }, top: { type: 'uniform', color: '#25385e', badge: true }, bottom: { type: 'pants', color: '#1c2a45' }, shoes: '#111111', hat: 'officer' },
  lola:   { name: 'Lola', role: 'explorer', body: 'regular', skin: 'deep', hair: { type: 'puffs', color: '#16100c' }, top: { type: 'overalls', color: '#e58a2e', under: '#f6ecd9' }, bottom: { type: 'overalls', color: '#e58a2e' }, shoes: '#6b4426' },
  viktor: { name: 'Viktor', role: 'boss', body: 'regular', skin: 'pale', hair: { type: 'slick', color: '#232323' }, top: { type: 'suit', color: '#30343c', under: '#f4f4f4', tie: '#b3262e' }, bottom: { type: 'pants', color: '#30343c' }, shoes: '#141414' },
  ike:    { name: 'Ike', role: 'adventurer', body: 'strong', skin: 'warm', hair: { type: 'short', color: '#6b4a2b' }, top: { type: 'puffer', color: '#d9452b' }, bottom: { type: 'pants', color: '#3e4a3a' }, shoes: '#4a3020', hat: 'beanie', hatColor: '#2f4f6f', acc: ['stubble'] },
  mei:    { name: 'Mei', role: 'doctor', body: 'regular', skin: 'light', hair: { type: 'bob', color: '#141110' }, top: { type: 'scrubs', color: '#5fb3c8' }, bottom: { type: 'pants', color: '#5fb3c8' }, shoes: '#f2f2f2' },
  rex:    { name: 'Rex', role: 'athlete', body: 'strong', skin: 'brown', hair: { type: 'spiky', color: '#24170f' }, top: { type: 'tank', color: '#f2f2f2', trim: '#d8432b' }, bottom: { type: 'shorts', color: '#d8432b' }, shoes: '#2f8de0' },
  tess:   { name: 'Tess', role: 'pilot', body: 'slim', skin: 'warm', hair: { type: 'ponytail', color: '#b5652b' }, top: { type: 'jacket', color: '#6b5236' }, bottom: { type: 'pants', color: '#3a3f47' }, shoes: '#2a1f18', hat: 'cap', hatColor: '#2f6fb0', face: { y: -.06 } },
  hugo:   { name: 'Hugo', role: 'chef', body: 'round', skin: 'light', hair: { type: 'short', color: '#2b1d14' }, top: { type: 'chef', color: '#fbfbf7', collar: '#d8432b' }, bottom: { type: 'pants', color: '#2c2c2c' }, shoes: '#1e1e1e', hat: 'chef', acc: ['mustache'] },
  ada:    { name: 'Ada', role: 'engineer', body: 'regular', skin: 'pale', hair: { type: 'wavy', color: '#c4472b' }, top: { type: 'sweater', color: '#3a6fb0', pattern: 'stripes', color2: '#f2efe6' }, bottom: { type: 'pants', color: '#3c3c44' }, shoes: '#7a4a2a', acc: ['freckles'] },
  bo:     { name: 'Bo', role: 'little kid', body: 'kid', skin: 'light', hair: { type: 'tuft', color: '#e0b35a' }, top: { type: 'tee', color: '#7cc24a' }, bottom: { type: 'shorts', color: '#3d5a80' }, shoes: '#e2432f', hat: 'cap-back', hatColor: '#2f6fb0' },
  zed:    { name: 'Zed', role: 'shady guy', body: 'slim', skin: 'tan', hair: { type: 'slick', color: '#0f0f0f' }, top: { type: 'leather', color: '#2a2a2e' }, bottom: { type: 'pants', color: '#1b1b20' }, shoes: '#0d0d0d', acc: ['sunglasses', 'stubble'] },
};
// Topic outfits any character can wear over its own look: S.char('milo', { outfit: 'astronaut' }).
// gloves: hand colour; boots: shoe style (boot | fin | sandal); limbs: thickness multipliers of the sleeves/legs (bulky suits)
export const OUTFITS = {
  astronaut: { top: { type: 'spacesuit', color: '#f1f1ee', trim: '#e2432f' }, bottom: { type: 'spacesuit', color: '#f1f1ee' }, shoes: '#c9c9c4', boots: 'boot', gloves: '#e4e4de', limbs: { arm: 2.3, leg: 2.2 }, hat: 'helmet', acc: ['backpack-tank'] },
  diver:     { top: { type: 'wetsuit', color: '#1f2a33', trim: '#f2c200' }, bottom: { type: 'wetsuit', color: '#1f2a33' }, shoes: '#f2c200', boots: 'fin', gloves: '#1f2a33', limbs: { arm: 1.25, leg: 1.25 }, hat: 'dive-mask', acc: ['air-tank'] },
  hazmat:    { top: { type: 'hazmat', color: '#f2c94c' }, bottom: { type: 'hazmat', color: '#f2c94c' }, shoes: '#2b2b2b', boots: 'boot', gloves: '#2b2b2b', limbs: { arm: 2, leg: 1.9 }, hat: 'hazmat-hood' },
  explorer:  { top: { type: 'safari', color: '#c8a36a' }, bottom: { type: 'shorts', color: '#8a7350' }, shoes: '#5a3a20', boots: 'boot', hat: 'pith', acc: ['backpack'] },
  winter:    { top: { type: 'puffer', color: '#3f6fd1' }, bottom: { type: 'pants', color: '#2b3440' }, shoes: '#4a3020', boots: 'boot', gloves: '#c8442e', limbs: { arm: 1.9, leg: 1 }, hat: 'beanie', hatColor: '#c8442e', acc: ['scarf'] },
  beach:     { top: { type: 'shirt-open', color: '#f08a2a', pattern: 'flowers', color2: '#fff3d6', under: null }, bottom: { type: 'shorts', color: '#2f6fb0' }, shoes: '#c9a27a', boots: 'sandal' },
  worker:    { top: { type: 'tee', color: '#f08a2a', vest: '#d9f23a' }, bottom: { type: 'pants', color: '#3d4a5c' }, shoes: '#4a3020', boots: 'boot', gloves: '#e0b35a', hat: 'hardhat' },
  medieval:  { top: { type: 'tunic', color: '#7a5a3a', belt: '#3a2a1a' }, bottom: { type: 'legs', color: '#5a4a3a' }, shoes: '#3a2a1a', boots: 'boot' },
  knight:    { top: { type: 'armor', color: '#b9c0c8' }, bottom: { type: 'armor', color: '#b9c0c8' }, shoes: '#8a9098', boots: 'boot', gloves: '#9aa2ab', limbs: { arm: 1.8, leg: 1.8 }, hat: 'helm' },
  pharaoh:   { top: { type: 'robe', color: '#f2ead2', trim: '#e9b44c' }, bottom: { type: 'robe', color: '#f2ead2' }, shoes: '#c9a27a', boots: 'sandal', hat: 'nemes' },
  pilot:     { top: { type: 'flightsuit', color: '#6b7a4f' }, bottom: { type: 'flightsuit', color: '#6b7a4f' }, shoes: '#2a1f18', boots: 'boot', limbs: { arm: 1.3, leg: 1.2 }, hat: 'pilot-cap' },
  sailor:    { top: { type: 'sailor', color: '#f2efe6', pattern: 'stripes', color2: '#1d2b4f', tie: '#d8432b' }, bottom: { type: 'pants', color: '#1d2b4f' }, shoes: '#2a1f18', hat: 'sailor' },
};
export const castIds = () => Object.keys(CAST);
