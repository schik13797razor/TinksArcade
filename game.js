// Tink's Emote Jar: drop emotes into a jar; two of the same kind merge into the next one.
// Uses the shared tools in arcade.js (best scores, seeded drops, difficulty, copy result).

// ===================== CONFIG: every tunable number lives here =====================
const CONFIG = {
  id: 'emote-jar',
  title: "Tink's Emote Jar",

  // Layout, in board units (the board is 636 x 1000; see arcade.js).
  hudHeight: 110,      // score bar at the top
  dropperY: 180,       // where new items hang before they drop
  lineY: 250,          // the game-over line
  jar: {
    width: 560,        // inside width
    bottomY: 940,      // inside floor
    wallThickness: 60, // physics walls; thick so fast items can't slip through
  },

  // 8 tiers, smallest first. points = score for merging two of this tier.
  // Sizes and points are the same in every skin; how they look is set in skins below.
  tiers: [
    { radius: 26, points: 2 },
    { radius: 36, points: 5 },
    { radius: 48, points: 10 },
    { radius: 60, points: 20 },
    { radius: 74, points: 40 },
    { radius: 90, points: 80 },
    { radius: 108, points: 160 },
    { radius: 130, points: 0 }, // tier 8 can't merge up; see bigBonus
  ],

  // ---------- Skins: how the game looks and sounds. Cosmetic only. ----------
  // Each skin's key (tink, coffee-shop, fine-dining) is also its folder name for art and sounds:
  //   assets/skins/<key>/tier1.png ... tier8.png   square, transparent background, 256 x 256 or bigger
  //   assets/skins/<key>/<sound file names below>  any short .mp3, .ogg or .wav (spill is used by Table Push;
  //                                                 ambient is a background loop, see ambience.js)
  //   assets/skins/<key>/jar-background.png, jar.png, table.png, table-surround.png
  //                                                 the scene art; sizes are listed at the top of scenes.js
  // Any file that isn't there falls back to the code-drawn version or the built-in sound.
  //   name:       shown in the skin picker and the copied result
  //   background: the plain color shown while the scene art loads
  //   label:      what the placeholder shapes show: 'number' (the tier) or 'name'
  //   tiers:      8 names and placeholder colors, smallest first (colors also tint the pixel bursts)
  //   ui:         button, text and panel colors for this skin (any color left out uses the
  //               arcade's own from arcade.js). Fills are numbers (0x...), text colors are strings.
  // The scenes themselves (room, jar, table) are drawn in scenes.js.
  defaultSkin: 'tink',
  skins: {
    tink: {
      name: 'Tink',
      background: '#1a1030',
      label: 'number',
      tiers: [
        { name: 'Emote 1', color: '#ff9ecb' },
        { name: 'Emote 2', color: '#ffd166' },
        { name: 'Emote 3', color: '#7ee081' },
        { name: 'Emote 4', color: '#5ec8ff' },
        { name: 'Emote 5', color: '#b28dff' },
        { name: 'Emote 6', color: '#ff8c42' },
        { name: 'Emote 7', color: '#2ec4b6' },
        { name: 'Emote 8', color: '#ffe14d' },
      ],
      sounds: { drop: 'drop.mp3', merge: 'merge.mp3', bonus: 'bonus.mp3', gameOver: 'game-over.mp3', newBest: 'new-best.mp3', spill: 'spill.mp3', ambient: 'ambient.mp3' },
      // Cozy cottage: warm wood and lamp light, with the arcade's pink buttons.
      ui: {
        panel: 0x2e1d2c,
        secondary: 0x4a2f3f,
        secondaryHover: 0x5c3c4f,
        border: 0x7a5468,
        muted: '#e0c3cf',
      },
    },
    'coffee-shop': {
      name: 'Coffee Shop',
      background: '#24170f',
      label: 'name',
      tiers: [
        { name: 'Coffee bean', color: '#a8714a' },
        { name: 'Powder scoop', color: '#f3e6cc' },
        { name: 'Small iced cup', color: '#a8dcef' },
        { name: 'Large iced cup', color: '#4fa3d1' },
        { name: 'Shaker bottle', color: '#f07c5a' },
        { name: 'Cold brew tub', color: '#3f8f7a' },
        { name: 'Coffee bag', color: '#d9a54a' },
        { name: "Tink's signature tub", color: '#ff5fa2' },
      ],
      sounds: { drop: 'drop.mp3', merge: 'merge.mp3', bonus: 'bonus.mp3', gameOver: 'game-over.mp3', newBest: 'new-best.mp3', spill: 'spill.mp3', ambient: 'ambient.mp3' },
      // Espresso browns with caramel buttons.
      ui: {
        panel: 0x2b1d14,
        primary: 0xe6a35c,
        primaryHover: 0xf0b877,
        secondary: 0x4a3426,
        secondaryHover: 0x5c4231,
        selected: 0xf3dcae,
        border: 0x80603f,
        text: '#fff4e6',
        textDark: '#2b1a0e',
        muted: '#d9c09c',
        accent: '#ffb36b',
      },
    },
    'fine-dining': {
      name: 'Fine Dining',
      background: '#1a1012',
      label: 'name',
      tiers: [
        { name: 'Grape', color: '#9a6ab8' },
        { name: 'Cork', color: '#e2c590' },
        { name: 'Wine glass', color: '#c0395e' },
        { name: 'Champagne flute', color: '#f5dd7a' },
        { name: 'Decanter', color: '#46a6ad' },
        { name: 'Wine bottle', color: '#4f9a5c' },
        { name: 'Ice bucket', color: '#b8c2cc' },
        { name: 'Wine barrel', color: '#b8743f' },
      ],
      sounds: { drop: 'drop.mp3', merge: 'merge.mp3', bonus: 'bonus.mp3', gameOver: 'game-over.mp3', newBest: 'new-best.mp3', spill: 'spill.mp3', ambient: 'ambient.mp3' },
      // Dark wood and candlelight, with gold buttons.
      ui: {
        panel: 0x22161a,
        primary: 0xd9b55e,
        primaryHover: 0xe8c878,
        secondary: 0x3d2a2f,
        secondaryHover: 0x4d363c,
        selected: 0xf2e2b3,
        border: 0x86683f,
        text: '#fbf3e4',
        textDark: '#24180c',
        muted: '#d2bd96',
        accent: '#f0c96a',
      },
    },
  },
  // Old skin names, so a skin picked before a rename is still remembered.
  renamedSkins: { 'coffee-counter': 'coffee-shop', 'bar-night': 'fine-dining' },
  bigBonus: 1000,       // two tier-8 items touching: both vanish, plus this

  spawnTiers: [1, 2, 3], // new drops are picked at random from these

  physics: {
    gravity: 1.6,
    restitution: 0.15,  // bounciness, 0 to 1
    friction: 0.08,
    frictionStatic: 0.4,
    frictionAir: 0.01,
    density: 0.001,
  },

  dropCooldownMs: 550,  // wait between drops
  overflowMs: 2000,     // an item above the line this long ends the game
  warnAfter: 0.3,       // the line starts flashing after this share of overflowMs
  dropperSpeed: 700,    // arrow keys, board units per second

  // Pixel bursts for big merges.
  effects: {
    burstFromTier: 6,      // merges that make this tier or bigger get a burst
    burstPixels: 18,       // pixels in the smallest burst...
    burstPixelsPerTier: 12, // ...plus this many for each tier above it
    burstSpeed: [150, 450], // how fast pixels fly out (min, max)
    burstLifeMs: 700,      // how long pixels last
    pixelSize: 10,         // board units (5 screen pixels in the Twitch panel)
    bonusPixels: 90,       // the two-tier-8 burst
    bonusSpeed: [250, 750],
    bonusLifeMs: 1100,
  },

  // Built-in sounds, made on the fly (the note fields are explained above Arcade.sfx in arcade.js).
  // A skin's sound file replaces the matching one here.
  sounds: {
    volume: 1, // this game's level, 0 to 1, on top of the arcade's master volume
    mergeRateStep: 0.07, // with a merge sound file: each tier plays it this much faster (and higher)
    drop: [
      { noise: true, filter: 1400, duration: 0.06, volume: 0.25 },
      { freq: 300, to: 160, duration: 0.09, volume: 0.25 },
    ],
    // Merge pop pitch in Hz for tiers 1 to 7; it climbs as the items grow.
    mergePitch: [523, 587, 659, 784, 880, 1047, 1175],
    mergeVolume: 0.3,
    bonus: [ // two tier-8 items
      { noise: true, filter: 3000, duration: 0.35, volume: 0.15 },
      { freq: 523, type: 'triangle', duration: 0.18, volume: 0.25 },
      { freq: 659, type: 'triangle', duration: 0.18, volume: 0.25, delay: 0.07 },
      { freq: 784, type: 'triangle', duration: 0.18, volume: 0.25, delay: 0.14 },
      { freq: 1047, type: 'triangle', duration: 0.3, volume: 0.25, delay: 0.21 },
      { freq: 1319, type: 'triangle', duration: 0.45, volume: 0.2, delay: 0.28 },
    ],
    gameOver: [
      { freq: 392, duration: 0.25, volume: 0.25 },
      { freq: 330, duration: 0.25, volume: 0.25, delay: 0.18 },
      { freq: 262, duration: 0.5, volume: 0.25, delay: 0.36 },
    ],
    newBest: [
      { freq: 523, type: 'triangle', duration: 0.2, volume: 0.25 },
      { freq: 659, type: 'triangle', duration: 0.2, volume: 0.25, delay: 0.1 },
      { freq: 784, type: 'triangle', duration: 0.2, volume: 0.25, delay: 0.2 },
      { freq: 1047, type: 'triangle', duration: 0.5, volume: 0.25, delay: 0.3 },
    ],
  },

  // Weekly mode applies one of these, chosen by the week number (week 1 = first entry).
  // Fields you can use: jarWidthMul, gravityMul, cooldownMul, frictionMul (multipliers),
  // restitution, spawnTiers (replace the normal value), lineDropPx (moves the line down).
  weeklyModifiers: [
    { name: 'Snug Jar', desc: 'The jar is narrower.', jarWidthMul: 0.85 },
    { name: 'Heavy Drops', desc: 'Items fall faster.', gravityMul: 1.5 },
    { name: 'Quick Hands', desc: 'Shorter wait between drops.', cooldownMul: 0.5 },
    { name: 'Bouncy', desc: 'Everything bounces more.', restitution: 0.55 },
    { name: 'Big Start', desc: 'Drops come in tiers 2 to 4.', spawnTiers: [2, 3, 4] },
    { name: 'Low Lid', desc: 'The line sits lower.', lineDropPx: 70 },
    { name: 'Slippery', desc: 'Items slide more.', frictionMul: 0.2 },
  ],
};
// ===================================================================================

function weeklyModifier(week) {
  const list = CONFIG.weeklyModifiers;
  return list[(week - 1) % list.length];
}

// Combines CONFIG, the difficulty preset and (in Weekly) the week's modifier.
function buildRules(mode, difficultyId, period) {
  const d = Arcade.difficulty(difficultyId);
  const m = mode === 'weekly' ? weeklyModifier(period.week) : {};
  const p = CONFIG.physics;
  return {
    modifier: mode === 'weekly' ? m : null,
    jarWidth: CONFIG.jar.width * (m.jarWidthMul ?? 1),
    lineY: CONFIG.lineY + (m.lineDropPx ?? 0),
    gravity: p.gravity * d.speed * (m.gravityMul ?? 1),
    cooldownMs: CONFIG.dropCooldownMs * d.cooldown * (m.cooldownMul ?? 1),
    overflowMs: CONFIG.overflowMs * d.forgiveness,
    restitution: m.restitution ?? p.restitution,
    friction: p.friction * (m.frictionMul ?? 1),
    spawnTiers: m.spawnTiers ?? CONFIG.spawnTiers,
  };
}

// ---------- Skins ----------
function skinIdOrDefault(id) {
  id = CONFIG.renamedSkins[id] || id;
  return CONFIG.skins[id] ? id : CONFIG.defaultSkin;
}

function tierTextureKey(skinId, tier) {
  return `${CONFIG.id}-${skinId}-tier-${tier}`;
}

// The loader key for one of a skin's files (art or sound).
function skinFileKey(skinId, file) {
  return `${CONFIG.id}-${skinId}-file-${file}`;
}

function tierArtFile(tier) {
  return `tier${tier}.png`;
}

// Tries to load every skin's art and sound files, once per page load. Files that
// aren't there just fail quietly (the browser console shows them as "not found").
const triedSkinFiles = new Set();
function loadSkinFiles(scene) {
  for (const [skinId, skin] of Object.entries(CONFIG.skins)) {
    const base = `assets/skins/${skinId}/`;
    CONFIG.tiers.forEach((t, i) => {
      const file = tierArtFile(i + 1);
      const key = skinFileKey(skinId, file);
      if (triedSkinFiles.has(key)) return;
      triedSkinFiles.add(key);
      scene.load.image(key, base + file);
    });
    for (const file of Object.values(skin.sounds)) {
      const key = skinFileKey(skinId, file);
      if (!file || triedSkinFiles.has(key)) continue;
      triedSkinFiles.add(key);
      scene.load.audio(key, base + file);
    }
    for (const file of SkinScenes.filesFor(skinId)) { // scene art: see scenes.js
      const key = skinFileKey(skinId, file);
      if (triedSkinFiles.has(key)) continue;
      triedSkinFiles.add(key);
      scene.load.image(key, base + file);
    }
  }
}

// Tells the background sound player which skin is on screen (it plays only if the
// player turned it on in Settings). Every start screen and game screen calls this.
function startAmbience(scene, skinId) {
  Arcade.ambience.setSkin(scene, skinId, skinFileKey(skinId, CONFIG.skins[skinId].sounds.ambient));
}

// Plays one of the skin's sounds: its file if one loaded, otherwise the built-in notes.
function playSkinSound(scene, skinId, name, notes, rate = 1) {
  const file = CONFIG.skins[skinId].sounds[name];
  const key = file && skinFileKey(skinId, file);
  if (key && scene.cache.audio.exists(key)) {
    Arcade.sfx.playFile(scene, key, name, CONFIG.sounds.volume, rate);
  } else {
    Arcade.sfx.play(scene, notes, name, CONFIG.sounds.volume);
  }
}

// Room around each item's texture for its outline and shadow. The physics circle
// doesn't change: it's set from the tier's radius, not from the texture.
const ITEM_PAD = 6;

// Makes one texture per tier for a skin, sized to the tier: the skin's art if
// it loaded, otherwise a placeholder shape, with an outline and a soft shadow so
// it stands out on any scene. Runs after loadSkinFiles has finished.
function ensureSkinTextures(scene, skinId) {
  CONFIG.tiers.forEach((t, i) => {
    const key = tierTextureKey(skinId, i + 1);
    if (!scene.textures.exists(key)) makeTierTexture(scene, skinId, i + 1, t.radius, key);
  });
}

// The same item drawn at any radius (Pop Shot shows every tier at one size).
// Returns the texture key. Runs after loadSkinFiles has finished.
function tierTextureAtRadius(scene, skinId, tier, radius) {
  const key = `${tierTextureKey(skinId, tier)}-r${radius}`;
  if (!scene.textures.exists(key)) makeTierTexture(scene, skinId, tier, radius, key);
  return key;
}

function makeTierTexture(scene, skinId, tier, radius, key) {
  const size = radius * 2;
  const art = document.createElement('canvas');
  art.width = size;
  art.height = size;
  const file = skinFileKey(skinId, tierArtFile(tier));
  if (scene.textures.exists(file)) {
    drawArt(art.getContext('2d'), scene.textures.get(file).getSourceImage(), size);
  } else {
    drawPlaceholder(art.getContext('2d'), radius, tier, CONFIG.skins[skinId]);
  }
  const tex = scene.textures.createCanvas(key, size + ITEM_PAD * 2, size + ITEM_PAD * 2);
  drawWithOutline(tex.getContext(), art, ITEM_PAD);
  tex.refresh();
}

// Draws the item with a dark outline that follows its shape, and a soft shadow under it.
// The item is drawn 4 units smaller, so the outline ends where the physics circle does.
function drawWithOutline(ctx, art, pad) {
  const size = art.width - 4;
  const at = pad + 2;
  const shape = document.createElement('canvas'); // a dark copy of the item's shape
  shape.width = art.width;
  shape.height = art.height;
  const s = shape.getContext('2d');
  s.drawImage(art, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#140a12';
  s.fillRect(0, 0, shape.width, shape.height);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.globalAlpha = 0.6;
  ctx.drawImage(shape, at, at, size, size);
  ctx.restore();
  ctx.globalAlpha = 0.75;
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    ctx.drawImage(shape, at + Math.cos(a) * 2.5, at + Math.sin(a) * 2.5, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(art, at, at, size, size);
}

// Fits the image inside the square, keeping its shape.
function drawArt(ctx, img, size) {
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

// A colored circle with a shine, labeled with the tier number or the tier's name.
function drawPlaceholder(ctx, r, tier, skin) {
  const color = skin.tiers[tier - 1].color;
  ctx.beginPath();
  ctx.arc(r, r, r - 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.62, r * 0.58, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  ctx.fillStyle = isLight(color) ? '#2a1640' : '#fff6fb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (skin.label === 'number') {
    ctx.font = `bold ${Math.round(r * 0.95)}px sans-serif`;
    ctx.fillText(String(tier), r, r * 1.06);
    return;
  }
  const { size, lines } = fitLabel(ctx, skin.tiers[tier - 1].name, r * 1.6, 3, Math.round(r * 0.42), 10);
  ctx.font = `bold ${size}px sans-serif`;
  const lineHeight = size * 1.1;
  lines.forEach((line, n) => {
    ctx.fillText(line, r, r + (n - (lines.length - 1) / 2) * lineHeight);
  });
}

// Picks the biggest font size (startSize down to minSize) at which the text wraps
// into maxLines or fewer, each no wider than maxWidth.
function fitLabel(ctx, text, maxWidth, maxLines, startSize, minSize) {
  for (let size = startSize; size > minSize; size--) {
    ctx.font = `bold ${size}px sans-serif`;
    const lines = wrapWords(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { size, lines };
    }
  }
  ctx.font = `bold ${minSize}px sans-serif`;
  return { size: minSize, lines: wrapWords(ctx, text, maxWidth) };
}

function wrapWords(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? line + ' ' + word : word;
    if (line && ctx.measureText(longer).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// True for pale colors, which need dark text on top.
function isLight(hex) {
  const c = Phaser.Display.Color.HexStringToColor(hex);
  return 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue > 150;
}

// A bubbly pop: a quick upward slide, then a soft higher note.
function mergeSound(tier) {
  const s = CONFIG.sounds;
  const pitch = s.mergePitch[Math.min(tier, s.mergePitch.length) - 1];
  return [
    { freq: pitch * 0.6, to: pitch, duration: 0.09, volume: s.mergeVolume },
    { freq: pitch * 1.5, type: 'triangle', duration: 0.14, volume: s.mergeVolume * 0.4, delay: 0.035 },
  ];
}

function bestKey(period, difficultyId) {
  return `${CONFIG.id}:${period.key}:${difficultyId}`;
}

// The jar's inside edges at its normal width (the start screen shows this one).
function standardJar() {
  const W = Arcade.config.width;
  return { left: W / 2 - CONFIG.jar.width / 2, right: W / 2 + CONFIG.jar.width / 2, bottom: CONFIG.jar.bottomY };
}

// ---------------------------------- Start screen ----------------------------------
class EmoteJarStart extends Phaser.Scene {
  constructor() {
    super('EmoteJarStart');
  }

  preload() {
    loadSkinFiles(this);
  }

  create() {
    const W = Arcade.config.width;
    const ui = Arcade.ui;
    const last = Arcade.store.get(CONFIG.id + ':last', {});
    this.mode = ['free', 'daily', 'weekly'].includes(last.mode) ? last.mode : 'free';
    this.difficultyId = Arcade.config.difficulties[last.difficulty] ? last.difficulty : 'normal';
    this.skinId = skinIdOrDefault(last.skin);
    this.skinIds = Object.keys(CONFIG.skins);
    this.skinIds.forEach((id) => ensureSkinTextures(this, id));

    // The chosen skin's jar scene, dimmed, with its button colors.
    Arcade.ui.setColors(this, CONFIG.skins[this.skinId].ui);
    const col = Arcade.ui.colors(this);
    this.cameras.main.setBackgroundColor(CONFIG.skins[this.skinId].background);
    SkinScenes.addJarScene(this, this.skinId, standardJar());
    this.add.rectangle(W / 2, Arcade.config.height / 2, W, Arcade.config.height, col.panel, 0.62);
    startAmbience(this, this.skinId);

    ui.settingsButton(this, 48, 44, () =>
      this.scene.start('ArcadeSettings', { back: 'EmoteJarStart', colors: CONFIG.skins[this.skinId].ui }));
    ui.muteButton(this, W - 48, 44);
    ui.text(this, W / 2, 95, CONFIG.title, 56);
    ui.text(this, W / 2, 152, 'Drop. Match two. Merge.', 30, col.muted, { bold: false });

    ui.text(this, W / 2, 215, 'MODE', 26, col.muted);
    this.modeButtons = {};
    Arcade.config.modes.forEach((m, i) => {
      this.modeButtons[m.id] = ui.button(this, 108 + i * 210, 268, 190, 70, m.label,
        () => this.select(m.id, this.difficultyId, this.skinId), { kind: 'toggle', fontSize: 30 });
    });

    ui.text(this, W / 2, 340, 'DIFFICULTY', 26, col.muted);
    this.difficultyButtons = {};
    Arcade.config.difficultyOrder.forEach((id, i) => {
      this.difficultyButtons[id] = ui.button(this, 108 + i * 210, 393, 190, 70, Arcade.difficulty(id).label,
        () => this.select(this.mode, id, this.skinId), { kind: 'toggle', fontSize: 30 });
    });

    // Skin picker: arrows either side of the name, and the 8 tiers underneath.
    ui.text(this, W / 2, 465, 'SKIN', 26, col.muted);
    ui.button(this, 58, 518, 90, 70, '‹', () => this.cycleSkin(-1), { kind: 'secondary', fontSize: 48 });
    ui.button(this, W - 58, 518, 90, 70, '›', () => this.cycleSkin(1), { kind: 'secondary', fontSize: 48 });
    this.skinName = ui.text(this, W / 2, 518, '', 34);
    this.skinPreview = CONFIG.tiers.map((t, i) => this.add.image(0, 590, tierTextureKey(this.skinId, i + 1)));

    this.info = ui.text(this, W / 2, 672, '', 28, col.text, { bold: false, wrap: 560 });
    this.bestText = ui.text(this, W / 2, 742, '', 28, col.muted);

    ui.button(this, W / 2, 815, 380, 90, 'Play', () => {
      this.scene.start('EmoteJarPlay', { mode: this.mode, difficulty: this.difficultyId, skin: this.skinId });
    }, { fontSize: 44 });
    ui.button(this, W / 2, 906, 260, 60, 'Back to arcade', () => this.scene.start('ArcadeMenu'),
      { kind: 'secondary', fontSize: 28 });

    ui.text(this, W / 2, 968, 'Aim with mouse, touch or arrows. Click, tap or Space to drop.', 22, col.muted,
      { bold: false, wrap: 600 });

    this.select(this.mode, this.difficultyId, this.skinId);
  }

  // Saves the new skin, then redraws the screen in its scene and colors.
  cycleSkin(step) {
    const i = this.skinIds.indexOf(this.skinId);
    const next = this.skinIds[(i + step + this.skinIds.length) % this.skinIds.length];
    this.select(this.mode, this.difficultyId, next);
    this.scene.restart();
  }

  // Shows the skin's 8 tiers in a row, growing from small to big like in the jar.
  showSkinPreview() {
    const W = Arcade.config.width;
    const sizes = this.skinPreview.map((img, i) => 40 + i * 5);
    const gap = 8;
    const total = sizes.reduce((sum, s) => sum + s, 0) + gap * (sizes.length - 1);
    let x = W / 2 - total / 2;
    this.skinPreview.forEach((img, i) => {
      img.setTexture(tierTextureKey(this.skinId, i + 1));
      img.setDisplaySize(sizes[i], sizes[i]);
      img.x = x + sizes[i] / 2;
      x += sizes[i] + gap;
    });
  }

  select(mode, difficultyId, skinId) {
    this.mode = mode;
    this.difficultyId = difficultyId;
    this.skinId = skinId;
    Arcade.store.set(CONFIG.id + ':last', { mode, difficulty: difficultyId, skin: skinId });
    for (const id in this.modeButtons) this.modeButtons[id].setSelected(id === mode);
    for (const id in this.difficultyButtons) this.difficultyButtons[id].setSelected(id === difficultyId);
    this.skinName.setText(CONFIG.skins[skinId].name);
    this.showSkinPreview();

    const period = Arcade.getPeriod(CONFIG.id, mode);
    if (mode === 'daily') {
      this.info.setText(`${period.label}: the same drops for everyone today.`);
    } else if (mode === 'weekly') {
      const m = weeklyModifier(period.week);
      this.info.setText(`${period.label}: ${m.name}. ${m.desc}\nSame drops for everyone this week.`);
    } else {
      this.info.setText('New random drops every game.');
    }
    const best = Arcade.getBest(bestKey(period, difficultyId));
    this.bestText.setText(best > 0 ? `Best: ${Arcade.formatScore(best)}` : '');
  }
}

// ---------------------------------- The game ----------------------------------
class EmoteJarPlay extends Phaser.Scene {
  constructor() {
    super('EmoteJarPlay');
  }

  init(data) {
    this.mode = data.mode || 'free';
    this.difficultyId = data.difficulty || 'normal';
    this.skinId = skinIdOrDefault(data.skin);
    this.skin = CONFIG.skins[this.skinId];
  }

  create() {
    const W = Arcade.config.width;
    this.period = Arcade.getPeriod(CONFIG.id, this.mode);
    this.rules = buildRules(this.mode, this.difficultyId, this.period);
    // The seeded generator is used only to pick drops, so everyone playing the
    // same Daily or Weekly gets the same sequence of items.
    this.rng = Arcade.createRng(this.period.seed);
    this.bestKey = bestKey(this.period, this.difficultyId);
    this.best = Arcade.getBest(this.bestKey);
    this.score = 0;
    this.items = new Set();
    this.mergeQueue = [];
    this.lastDropAt = -Infinity;
    this.isOver = false;
    this.aiming = false;

    ensureSkinTextures(this, this.skinId);
    Arcade.ui.setColors(this, this.skin.ui);
    this.cameras.main.setBackgroundColor(this.skin.background);
    startAmbience(this, this.skinId);

    // Jar edges.
    this.jarLeft = W / 2 - this.rules.jarWidth / 2;
    this.jarRight = W / 2 + this.rules.jarWidth / 2;
    this.jarBottom = CONFIG.jar.bottomY;

    this.setUpPhysics();
    this.drawJar();
    this.createHud();

    // Dropper: a guide line and the item waiting to drop.
    this.guide = this.add.graphics();
    this.held = this.add.image(W / 2, CONFIG.dropperY, this.tierKey(1));
    this.current = this.rollTier();
    this.next = this.rollTier();
    this.dropX = W / 2;
    this.refreshDropper();

    this.setUpInput();
  }

  // ---------- Setup ----------
  setUpPhysics() {
    const world = this.matter.world;
    world.resume();
    world.setGravity(0, this.rules.gravity);
    // More solver passes keep tall stacks steady.
    world.engine.positionIterations = 10;
    world.engine.velocityIterations = 8;

    const t = CONFIG.jar.wallThickness;
    const top = CONFIG.hudHeight;
    const height = this.jarBottom - top + t;
    const wall = { isStatic: true, friction: 0.3, label: 'wall' };
    this.matter.add.rectangle(this.jarLeft - t / 2, top + height / 2, t, height, wall);
    this.matter.add.rectangle(this.jarRight + t / 2, top + height / 2, t, height, wall);
    this.matter.add.rectangle(Arcade.config.width / 2, this.jarBottom + t / 2, this.rules.jarWidth + t * 2, t, wall);

    this.onCollision = (event) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA.gameObject;
        const b = pair.bodyB.gameObject;
        if (!a || !b || a.tier === undefined || b.tier === undefined) continue;
        if (a.tier !== b.tier || a.merging || b.merging) continue;
        a.merging = true;
        b.merging = true;
        this.mergeQueue.push([a, b]);
      }
    };
    world.on('collisionstart', this.onCollision);
    world.on('collisionactive', this.onCollision);
    this.events.once('shutdown', () => {
      world.off('collisionstart', this.onCollision);
      world.off('collisionactive', this.onCollision);
    });
  }

  // The skin's room and jar (scenes.js), then the game-over line and the labels under the jar.
  drawJar() {
    const col = Arcade.ui.colors(this);
    SkinScenes.addJarScene(this, this.skinId, { left: this.jarLeft, right: this.jarRight, bottom: this.jarBottom });

    // The game-over line: light dashes on a dark edge, so they show on any scene,
    // plus a red copy that flashes when something lingers above it.
    const y = this.rules.lineY;
    const dashes = (gfx, width, color, alpha, grow = 0) => {
      gfx.lineStyle(width, color, alpha);
      for (let x = this.jarLeft; x < this.jarRight; x += 28) {
        gfx.lineBetween(Math.max(this.jarLeft, x - grow), y, Math.min(x + 16 + grow, this.jarRight), y);
      }
    };
    const line = this.add.graphics();
    dashes(line, 9, 0x000000, 0.45, 2);
    dashes(line, 4, 0xffffff, 0.8);
    this.warnLine = this.add.graphics().setVisible(false);
    dashes(this.warnLine, 10, 0x000000, 0.5, 2);
    dashes(this.warnLine, 5, col.warn, 1);

    Arcade.ui.text(this, Arcade.config.width / 2, this.jarBottom + 34, this.contextLabel(), 24, col.text,
      { bold: false, stroke: true });
    Arcade.ui.muteButton(this, Arcade.config.width - 44, this.jarBottom + 32);
  }

  contextLabel() {
    const parts = [this.period.label, Arcade.difficulty(this.difficultyId).label];
    if (this.rules.modifier) parts.push(this.rules.modifier.name);
    return parts.join(' · ');
  }

  createHud() {
    const W = Arcade.config.width;
    const col = Arcade.ui.colors(this);
    const ui = Arcade.ui;
    // A solid bar behind the score, so it reads the same on every scene.
    const bar = this.add.graphics();
    bar.fillStyle(col.panel, 0.92);
    bar.fillRect(0, 0, W, CONFIG.hudHeight);
    bar.fillStyle(col.border, 1);
    bar.fillRect(0, CONFIG.hudHeight - 3, W, 3);

    ui.button(this, 76, 55, 112, 62, 'Menu', () => this.scene.start('EmoteJarStart'),
      { kind: 'secondary', fontSize: 28 }).setDepth(50);

    const left = { originX: 0 };
    ui.text(this, 160, 26, 'SCORE', 24, col.muted, left);
    this.scoreText = ui.text(this, 160, 66, '0', 44, col.text, left);
    ui.text(this, 350, 26, 'BEST', 24, col.muted, left);
    this.bestText = ui.text(this, 350, 66, Arcade.formatScore(this.best), 44, col.text, left);

    ui.text(this, W - 56, 22, 'NEXT', 24, col.muted);
    this.nextPreview = this.add.image(W - 56, 68, this.tierKey(1));
  }

  setUpInput() {
    // Mouse: moving aims. Touch: press and drag to aim, lift to drop.
    // A click or tap drops on release, so it works the same for both.
    this.input.on('pointermove', (pointer) => {
      if (!this.isOver) this.setDropX(pointer.worldX);
    });
    this.input.on('pointerdown', (pointer, over) => {
      if (this.isOver || over.length > 0) return; // pressed a button, not the jar
      this.aiming = true;
      this.setDropX(pointer.worldX);
    });
    this.input.on('pointerup', () => {
      if (!this.aiming) return;
      this.aiming = false;
      this.dropItem();
    });

    const kb = this.input.keyboard;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  // ---------- Dropping ----------
  rollTier() {
    return this.rng.pick(this.rules.spawnTiers);
  }

  radiusOf(tier) {
    return CONFIG.tiers[tier - 1].radius;
  }

  // ---------- This round's skin ----------
  tierKey(tier) {
    return tierTextureKey(this.skinId, tier);
  }

  colorOf(tier) {
    return this.skin.tiers[tier - 1].color;
  }

  playEffect(name, notes, rate) {
    playSkinSound(this, this.skinId, name, notes, rate);
  }

  setDropX(x) {
    const r = this.radiusOf(this.current);
    this.dropX = Phaser.Math.Clamp(x, this.jarLeft + r + 2, this.jarRight - r - 2);
  }

  refreshDropper() {
    this.held.setTexture(this.tierKey(this.current));
    this.nextPreview.setTexture(this.tierKey(this.next));
    this.nextPreview.setScale(Math.min(1, 56 / (this.radiusOf(this.next) * 2)));
    this.setDropX(this.dropX);
  }

  dropItem() {
    if (this.isOver || this.time.now - this.lastDropAt < this.rules.cooldownMs) return;
    this.lastDropAt = this.time.now;
    this.createItem(this.current, this.dropX, CONFIG.dropperY);
    this.playEffect('drop', CONFIG.sounds.drop);
    this.current = this.next;
    this.next = this.rollTier();
    this.refreshDropper();
  }

  createItem(tier, x, y) {
    const p = CONFIG.physics;
    const item = this.matter.add.image(x, y, this.tierKey(tier), null, {
      shape: { type: 'circle', radius: this.radiusOf(tier) },
      restitution: this.rules.restitution,
      friction: this.rules.friction,
      frictionStatic: p.frictionStatic,
      frictionAir: p.frictionAir,
      density: p.density,
      label: 'item',
    });
    item.tier = tier;
    item.merging = false;
    item.aboveSince = null;
    this.items.add(item);
    return item;
  }

  removeItem(item) {
    this.items.delete(item);
    item.destroy();
  }

  // ---------- Merging ----------
  processMerges() {
    const queue = this.mergeQueue;
    this.mergeQueue = [];
    for (const [a, b] of queue) {
      if (!a.active || !b.active) continue;
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      const tier = a.tier;
      this.removeItem(a);
      this.removeItem(b);

      if (tier < CONFIG.tiers.length) {
        this.createItem(tier + 1, x, y);
        this.addScore(CONFIG.tiers[tier - 1].points, x, y, this.colorOf(tier + 1));
        this.playEffect('merge', mergeSound(tier), 1 + CONFIG.sounds.mergeRateStep * (tier - 1));
        this.mergeBurst(tier + 1, x, y);
      } else {
        // Two top-tier items: both vanish with a big bonus.
        this.addScore(CONFIG.bigBonus, x, y, this.colorOf(tier), true);
        this.playEffect('bonus', CONFIG.sounds.bonus);
        const fx = CONFIG.effects;
        Arcade.fx.pixelBurst(this, x, y, {
          count: fx.bonusPixels,
          colors: this.skin.tiers.map((t) => t.color).concat('#ffffff'),
          speedMin: fx.bonusSpeed[0],
          speedMax: fx.bonusSpeed[1],
          lifeMs: fx.bonusLifeMs,
          size: fx.pixelSize * 1.3,
        });
        this.cameras.main.shake(250, 0.008);
      }
    }
  }

  // A pixel burst in the new item's colors when a merge makes a big tier.
  mergeBurst(newTier, x, y) {
    const fx = CONFIG.effects;
    if (newTier < fx.burstFromTier) return;
    Arcade.fx.pixelBurst(this, x, y, {
      count: fx.burstPixels + (newTier - fx.burstFromTier) * fx.burstPixelsPerTier,
      colors: [this.colorOf(newTier), '#ffffff'],
      speedMin: fx.burstSpeed[0],
      speedMax: fx.burstSpeed[1],
      lifeMs: fx.burstLifeMs,
      size: fx.pixelSize,
    });
  }

  addScore(points, x, y, color, big = false) {
    this.score += points;
    this.scoreText.setText(Arcade.formatScore(this.score));
    // Save as soon as the best is beaten, so leaving mid-game (Menu, closing the tab) keeps it.
    if (Arcade.saveBest(this.bestKey, this.score)) this.bestText.setText(Arcade.formatScore(this.score));

    const ring = this.add.circle(x, y, big ? 90 : 40, Phaser.Display.Color.HexStringToColor(color).color, 0.5);
    this.tweens.add({ targets: ring, scale: big ? 3 : 1.8, alpha: 0, duration: big ? 500 : 260, onComplete: () => ring.destroy() });

    const label = Arcade.ui.text(this, x, y, '+' + Arcade.formatScore(points), big ? 64 : 34, Arcade.ui.colors(this).text,
      { stroke: true });
    label.setDepth(40);
    this.tweens.add({ targets: label, y: y - (big ? 120 : 70), alpha: 0, duration: big ? 1100 : 650, onComplete: () => label.destroy() });
  }

  // ---------- Each frame ----------
  update(time, delta) {
    if (this.isOver) return;

    const dir = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
    if (dir !== 0) this.setDropX(this.dropX + dir * CONFIG.dropperSpeed * (delta / 1000));
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.dropItem();

    this.processMerges();

    // Game-over check: an item whose top stays above the line for overflowMs.
    let worst = 0;
    for (const item of this.items) {
      if (item.merging) continue;
      if (item.y > Arcade.config.height + 300) { this.removeItem(item); continue; } // safety net
      if (item.y - this.radiusOf(item.tier) < this.rules.lineY) {
        if (item.aboveSince === null) item.aboveSince = time;
        const share = (time - item.aboveSince) / this.rules.overflowMs;
        if (share >= 1) { this.gameOver(); return; }
        worst = Math.max(worst, share);
      } else {
        item.aboveSince = null;
      }
    }
    const warn = worst > CONFIG.warnAfter;
    this.warnLine.setVisible(warn);
    if (warn) this.warnLine.setAlpha(0.5 + 0.5 * Math.sin(time / 70));

    // Dropper and guide line.
    const ready = time - this.lastDropAt >= this.rules.cooldownMs;
    this.held.setPosition(this.dropX, CONFIG.dropperY).setAlpha(ready ? 1 : 0.35);
    this.guide.clear();
    this.guide.lineStyle(7, 0x000000, 0.15);
    this.guide.lineBetween(this.dropX, CONFIG.dropperY, this.dropX, this.jarBottom);
    this.guide.lineStyle(3, 0xffffff, 0.22);
    this.guide.lineBetween(this.dropX, CONFIG.dropperY, this.dropX, this.jarBottom);
  }

  // ---------- Game over ----------
  gameOver() {
    this.isOver = true;
    this.aiming = false;
    this.matter.world.pause();
    this.warnLine.setVisible(true).setAlpha(1);
    // this.best is the best from before this round started.
    const isNewBest = this.score > this.best;
    const best = Math.max(this.best, this.score);
    if (isNewBest) this.playEffect('newBest', CONFIG.sounds.newBest);
    else this.playEffect('gameOver', CONFIG.sounds.gameOver);

    const W = Arcade.config.width;
    const H = Arcade.config.height;
    const col = Arcade.ui.colors(this);
    const ui = Arcade.ui;
    const depth = 100;
    const line = Arcade.resultLine(CONFIG.title, this.period, this.difficultyId, this.score, this.skin.name);

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(depth);
    const panel = this.add.graphics().setDepth(depth);
    panel.fillStyle(col.panel, 1);
    panel.fillRoundedRect(W / 2 - 270, 210, 540, 660, 28);

    ui.text(this, W / 2, 285, "The jar's full", 48).setDepth(depth + 1);
    ui.text(this, W / 2, 355, 'SCORE', 26, col.muted).setDepth(depth + 1);
    ui.text(this, W / 2, 420, Arcade.formatScore(this.score), 80).setDepth(depth + 1);
    ui.text(this, W / 2, 495, isNewBest ? 'New best!' : `Best: ${Arcade.formatScore(best)}`, 32,
      isNewBest ? col.accent : col.muted).setDepth(depth + 1);
    ui.text(this, W / 2, 550, line, 22, col.muted, { bold: false, wrap: 500 }).setDepth(depth + 1);

    ui.button(this, W / 2, 640, 400, 90, 'Restart',
      () => this.scene.restart({ mode: this.mode, difficulty: this.difficultyId, skin: this.skinId }), { fontSize: 40 }).setDepth(depth + 2);
    const copy = ui.button(this, W / 2, 740, 400, 76, 'Copy result', async () => {
      const ok = await Arcade.copyText(line);
      copy.setLabel(ok ? 'Copied' : "Couldn't copy");
      this.time.delayedCall(1500, () => copy.setLabel('Copy result'));
    }, { kind: 'toggle', fontSize: 32 }).setDepth(depth + 2);
    ui.button(this, W / 2, 828, 400, 64, 'Menu', () => this.scene.start('EmoteJarStart'),
      { kind: 'secondary', fontSize: 28 }).setDepth(depth + 2);
  }
}

Arcade.registerGame(
  { id: CONFIG.id, title: CONFIG.title, blurb: 'Drop emotes. Match two to merge them.', startScene: 'EmoteJarStart' },
  [EmoteJarStart, EmoteJarPlay],
);
