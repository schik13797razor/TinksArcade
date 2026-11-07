// Tink's Arcade: shared tools every game can use, plus the main menu.
//
// A game file (like game.js) defines its Phaser scenes, then calls
// Arcade.registerGame(...) so it shows up on the main menu.
//
// What's in here:
//   Arcade.getBest / saveBest     best scores, saved in the browser (localStorage)
//   Arcade.createRng(seed)        a seeded random generator (same seed = same numbers)
//   Arcade.getPeriod(game, mode)  the seed and label for Free Play, Daily or Weekly
//   Arcade.difficulty(id)         difficulty presets (Easy, Normal, Hard)
//   Arcade.resultLine / copyText  the short score line people paste into Discord
//   Arcade.sfx.play / playFile    short sound effects (made on the fly, or from a file), with a remembered mute
//   Arcade.fx.pixelBurst          a little pixel explosion for big moments
//   Arcade.ui.button / ui.text    simple buttons and text in the arcade style
//   Arcade.ui.setColors / colors  per-scene colors, so a skin can recolor buttons and text

const ARCADE_CONFIG = {
  title: "Tink's Arcade",

  // Every game is laid out on a 636 x 1000 board. That's twice the Twitch panel
  // size (318 x 500), so text stays sharp in the panel; Phaser scales the board
  // to fit any screen, from the panel to a phone to a full desktop window.
  width: 636,
  height: 1000,

  // Daily and Weekly challenges change at midnight in this time zone, so a day
  // means the same thing for everyone watching. Any IANA zone name works.
  seedTimeZone: 'America/Chicago',

  storagePrefix: 'tinks-arcade:',

  // Sound: short effects made on the fly by the browser's audio engine, so there
  // are no sound files to load. volume is the overall level, 0 to 1.
  sounds: {
    volume: 0.6,
    startMuted: false,
    click: [{ freq: 660, to: 880, type: 'triangle', duration: 0.05, volume: 0.15 }],
  },

  // Difficulty presets. Each game decides what these multipliers mean.
  //   speed:       how fast things move or fall (higher = faster)
  //   cooldown:    wait between actions (lower = shorter wait)
  //   forgiveness: grace time before a fail (lower = less time)
  difficulties: {
    easy: { label: 'Easy', speed: 0.85, cooldown: 1.25, forgiveness: 1.5 },
    normal: { label: 'Normal', speed: 1, cooldown: 1, forgiveness: 1 },
    hard: { label: 'Hard', speed: 1.25, cooldown: 0.75, forgiveness: 0.6 },
  },
  difficultyOrder: ['easy', 'normal', 'hard'],

  modes: [
    { id: 'free', label: 'Free Play' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
  ],

  font: '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif',
  colors: {
    background: 0x1a1030,
    panel: 0x2a1b4d,
    primary: 0xff5fa2,
    primaryHover: 0xff80b7,
    secondary: 0x3b2d5c,
    secondaryHover: 0x4a3a70,
    selected: 0x6ee7ff,
    border: 0x5b4a85,
    text: '#fff6fb',
    textDark: '#2a1640',
    muted: '#b9a8d9',
    accent: '#ff5fa2',
    warn: 0xff4d6d,
  },
};

const Arcade = (() => {
  const C = ARCADE_CONFIG;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const games = [];
  const scenes = [];

  // ---------- Storage ----------
  // localStorage can be blocked (private windows, some embedded frames), so
  // every read and write is wrapped: the game still plays, it just won't remember.
  const store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(C.storagePrefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(C.storagePrefix + key, JSON.stringify(value));
      } catch (e) {
        // Ignore: storage isn't available here.
      }
    },
  };

  function getBest(key) {
    const value = store.get('best:' + key, 0);
    return typeof value === 'number' ? value : 0;
  }

  // Saves the score if it beats the best. Returns true when it's a new best.
  function saveBest(key, score) {
    if (score > getBest(key)) {
      store.set('best:' + key, score);
      return true;
    }
    return false;
  }

  // ---------- Seeded random ----------
  // Turns any text into a 32-bit number (FNV-1a hash).
  function hashString(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Mulberry32: small, fast, and the same seed always gives the same sequence.
  function createRng(seed) {
    let a = seed >>> 0;
    function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      int(min, max) {
        return min + Math.floor(next() * (max - min + 1));
      },
      pick(list) {
        return list[Math.floor(next() * list.length)];
      },
    };
  }

  // ---------- Daily and weekly periods ----------
  function datePartsIn(timeZone, date) {
    let parts;
    try {
      parts = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
      }).formatToParts(date);
    } catch (e) {
      // Unknown time zone name: fall back to UTC.
      parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
      }).formatToParts(date);
    }
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { year: get('year'), month: get('month'), day: get('day') };
  }

  // ISO week: weeks start on Monday; week 1 is the week with the year's first Thursday.
  function isoWeek(year, month, day) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const weekday = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - weekday);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return { year: d.getUTCFullYear(), week };
  }

  const pad = (n) => String(n).padStart(2, '0');

  // Returns { mode, label, seed, key } for a game and mode.
  //   label: shown on screen and in the copied result ("Week 12", "Nov 6", "Free Play")
  //   seed:  feeds createRng; the same for everyone on that day or week
  //   key:   used to keep best scores separate per day or week
  function getPeriod(gameId, mode, now = new Date()) {
    const { year, month, day } = datePartsIn(C.seedTimeZone, now);
    if (mode === 'daily') {
      const key = `daily:${year}-${pad(month)}-${pad(day)}`;
      return { mode, label: `${MONTHS[month - 1]} ${day}`, seed: hashString(gameId + ':' + key), key };
    }
    if (mode === 'weekly') {
      const w = isoWeek(year, month, day);
      const key = `weekly:${w.year}-W${pad(w.week)}`;
      return { mode, label: `Week ${w.week}`, week: w.week, seed: hashString(gameId + ':' + key), key };
    }
    return { mode: 'free', label: 'Free Play', seed: Math.floor(Math.random() * 4294967296), key: 'free' };
  }

  function difficulty(id) {
    return C.difficulties[id] || C.difficulties.normal;
  }

  // ---------- Result line for Discord ----------
  function formatScore(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  // e.g. "Tink's Emote Jar · Week 12 · Hard · 4,820"
  // variant (optional): shown after the title, e.g. a skin name:
  //   "Tink's Emote Jar · Fine Dining · Week 12 · Hard · 4,820"
  function resultLine(gameTitle, period, difficultyId, score, variant) {
    const parts = [gameTitle];
    if (variant) parts.push(variant);
    parts.push(period.label, difficulty(difficultyId).label, formatScore(score));
    return parts.join(' · ');
  }

  // Copies text to the clipboard. Resolves true if it worked.
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // Fall through to the older method below.
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ---------- Sound effects ----------
  // A sound is a list of notes. Each note is a tone, or a burst of noise when noise: true.
  //   freq:     pitch in Hz          to:     slide to this pitch by the end
  //   type:     'sine', 'triangle', 'square' or 'sawtooth'
  //   duration: seconds              delay:  seconds before it starts
  //   volume:   0 to 1               filter: noise brightness in Hz (lower = duller thud)
  let noiseBuffer = null;

  function masterGain(scene, ctx) {
    if (!ctx.arcadeMaster) {
      const gain = ctx.createGain();
      gain.gain.value = C.sounds.volume;
      gain.connect(scene.sound.destination || ctx.destination);
      ctx.arcadeMaster = gain;
    }
    return ctx.arcadeMaster;
  }

  function playNote(ctx, out, note, now, volumeScale) {
    const start = now + (note.delay || 0);
    const duration = note.duration || 0.1;
    const peak = Math.max(0.0001, (note.volume ?? 0.3) * volumeScale);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.01, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(out);

    let source;
    if (note.noise) {
      if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = note.filter || 1000;
      source.connect(filter).connect(gain);
    } else {
      source = ctx.createOscillator();
      source.type = note.type || 'sine';
      source.frequency.setValueAtTime(note.freq || 440, start);
      if (note.to) source.frequency.exponentialRampToValueAtTime(note.to, start + duration);
      source.connect(gain);
    }
    source.start(start);
    source.stop(start + duration + 0.02);
    source.onended = () => gain.disconnect();
  }

  const sfx = {
    muted: !!store.get('muted', C.sounds.startMuted),
    lastPlayed: {},

    setMuted(value) {
      this.muted = value;
      store.set('muted', value);
    },

    // True if a sound with this key played in the last 40 ms (and marks it as playing now).
    recentlyPlayed(key) {
      if (!key) return false;
      const now = performance.now();
      if (now - (this.lastPlayed[key] ?? -Infinity) < 40) return true;
      this.lastPlayed[key] = now;
      return false;
    },

    // Plays a made-on-the-fly sound (a list of notes).
    // key: sounds with the same key don't stack when several fire at once (a chain of merges).
    // volume: scales every note (each game has its own level).
    play(scene, notes, key, volume = 1) {
      if (this.muted || !notes) return;
      const ctx = scene.sound && scene.sound.context;
      if (!ctx) return; // this browser has no Web Audio: stay silent
      if (ctx.state !== 'running') {
        // Browsers keep audio off until the first tap or click; skip this one sound.
        ctx.resume().catch(() => {});
        return;
      }
      if (this.recentlyPlayed(key)) return;
      const out = masterGain(scene, ctx);
      for (const note of notes) playNote(ctx, out, note, ctx.currentTime, volume);
    },

    // Plays a sound file the scene has already loaded (cacheKey is its loader key).
    // rate: playback speed, which also raises the pitch (1 = normal).
    playFile(scene, cacheKey, key, volume = 1, rate = 1) {
      if (this.muted) return;
      const ctx = scene.sound && scene.sound.context;
      if (ctx && ctx.state !== 'running') {
        ctx.resume().catch(() => {});
        return;
      }
      if (this.recentlyPlayed(key)) return;
      scene.sound.play(cacheKey, { volume: C.sounds.volume * volume, rate });
    },
  };

  // ---------- Visual effects ----------
  // A burst of little square pixels that fly out, fall and fade.
  // options: count, colors (list of hex strings like '#ff5fa2'), speedMin, speedMax,
  //          lifeMs, size (pixel size in board units), gravity
  function pixelBurst(scene, x, y, options = {}) {
    const key = 'arcade-pixel';
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, 8, 8);
      tex.getContext().fillStyle = '#ffffff';
      tex.getContext().fillRect(0, 0, 8, 8);
      tex.refresh();
    }
    const colors = (options.colors || ['#ffffff']).map((c) => Phaser.Display.Color.HexStringToColor(c).color);
    const lifeMs = options.lifeMs || 700;
    const size = (options.size || 10) / 8;
    const emitter = scene.add.particles(x, y, key, {
      speed: { min: options.speedMin || 150, max: options.speedMax || 450 },
      angle: { min: 0, max: 360 },
      lifespan: { min: lifeMs * 0.6, max: lifeMs },
      gravityY: options.gravity ?? 700,
      scale: { start: size, end: size * 0.3 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: colors,
      emitting: false,
    });
    emitter.setDepth(30);
    emitter.explode(options.count || 20);
    scene.time.delayedCall(lifeMs + 100, () => emitter.destroy());
    return emitter;
  }

  // ---------- UI helpers ----------
  // A scene can swap in its own colors (a skin's buttons, text and panels). Anything
  // it leaves out keeps the arcade's color. Call setColors at the start of create(),
  // before adding buttons: each button picks up the colors when it's made.
  function setColors(scene, overrides) {
    scene.arcadeColors = overrides ? { ...C.colors, ...overrides } : null;
  }

  function colors(scene) {
    return (scene && scene.arcadeColors) || C.colors;
  }

  // options: bold (default true), align, wrap (width), originX, originY,
  //          stroke: true for a dark outline, so text stays readable over busy scenery
  function text(scene, x, y, value, size, color, options = {}) {
    const t = scene.add
      .text(x, y, value, {
        fontFamily: C.font,
        fontSize: size + 'px',
        fontStyle: options.bold === false ? 'normal' : 'bold',
        color: color || colors(scene).text,
        align: options.align || 'center',
        wordWrap: options.wrap ? { width: options.wrap } : undefined,
      })
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5);
    if (options.stroke) t.setStroke('#120a10', Math.max(4, Math.round(size / 5)));
    return t;
  }

  // A rounded button. kind: 'primary' (pink), 'secondary' (grey, for way-out
  // choices like Back or Menu) or 'toggle' (one of a set; highlighted when selected).
  function button(scene, x, y, w, h, label, onClick, options = {}) {
    const kind = options.kind || 'primary';
    const col = colors(scene);
    const g = scene.add.graphics();
    const t = text(scene, x, y, label, options.fontSize || 34, col.text);
    const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    let hover = false;
    let selected = !!options.selected;

    function draw() {
      g.clear();
      let fill;
      let textColor = col.text;
      let border = null;
      if (kind === 'primary') {
        fill = hover ? col.primaryHover : col.primary;
        textColor = col.textDark;
      } else if (kind === 'toggle') {
        if (selected) {
          fill = col.selected;
          textColor = col.textDark;
        } else {
          fill = hover ? col.secondaryHover : col.panel;
          border = col.border;
        }
      } else {
        fill = hover ? col.secondaryHover : col.secondary;
      }
      const radius = Math.min(22, h / 2);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
      if (border !== null) {
        g.lineStyle(3, border, 1);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
      }
      t.setColor(textColor);
    }

    zone.on('pointerover', () => { hover = true; draw(); });
    zone.on('pointerout', () => { hover = false; draw(); });
    zone.on('pointerup', () => {
      sfx.play(scene, C.sounds.click, 'click');
      onClick();
    });
    draw();

    return {
      zone,
      setLabel(value) { t.setText(value); return this; },
      setSelected(value) { selected = value; draw(); return this; },
      setDepth(depth) { g.setDepth(depth); t.setDepth(depth + 1); zone.setDepth(depth + 1); return this; },
    };
  }

  // A speaker button that turns all arcade sound on or off. The choice is remembered.
  function muteButton(scene, x, y) {
    const w = 64;
    const h = 48;
    const g = scene.add.graphics();
    const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    let hover = false;

    const col = colors(scene);

    function draw() {
      const white = 0xfff6fb;
      g.clear();
      g.fillStyle(hover ? col.secondaryHover : col.secondary, 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      const ix = x - 10;
      g.fillStyle(white, 1);
      g.fillRect(ix - 9, y - 6, 9, 12);
      g.fillPoints([
        { x: ix, y: y - 6 }, { x: ix + 10, y: y - 14 },
        { x: ix + 10, y: y + 14 }, { x: ix, y: y + 6 },
      ], true);
      g.lineStyle(4, white, 1);
      if (sfx.muted) {
        g.lineBetween(ix + 16, y - 7, ix + 28, y + 7);
        g.lineBetween(ix + 16, y + 7, ix + 28, y - 7);
      } else {
        g.beginPath();
        g.arc(ix + 11, y, 8, -0.9, 0.9);
        g.strokePath();
        g.beginPath();
        g.arc(ix + 11, y, 16, -0.9, 0.9);
        g.strokePath();
      }
    }

    zone.on('pointerover', () => { hover = true; draw(); });
    zone.on('pointerout', () => { hover = false; draw(); });
    zone.on('pointerup', () => {
      sfx.setMuted(!sfx.muted);
      draw();
      sfx.play(scene, C.sounds.click, 'click');
    });
    draw();

    return {
      zone,
      setDepth(depth) { g.setDepth(depth); zone.setDepth(depth + 1); return this; },
    };
  }

  // ---------- Main menu ----------
  class MenuScene extends Phaser.Scene {
    constructor() {
      super('ArcadeMenu');
    }

    create() {
      const W = C.width;
      muteButton(this, W - 48, 44);
      text(this, W / 2, 170, C.title, 64);
      text(this, W / 2, 245, 'Pick a game', 32, C.colors.muted, { bold: false });

      let y = 380;
      for (const game of games) {
        button(this, W / 2, y, 500, 110, game.title, () => this.scene.start(game.startScene), { fontSize: 40 });
        text(this, W / 2, y + 72, game.blurb, 28, C.colors.muted, { bold: false, wrap: 500, originY: 0 });
        y += 220;
      }

      text(this, W / 2, 930, 'More games coming soon.', 28, C.colors.muted, { bold: false });
    }
  }

  // ---------- Registration and start-up ----------
  // info: { id, title, blurb, startScene }   gameScenes: Phaser.Scene classes
  function registerGame(info, gameScenes) {
    games.push(info);
    scenes.push(...gameScenes);
  }

  function boot(parentId) {
    // Kept on Arcade.game so you can poke at it from the browser console while testing.
    Arcade.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentId,
      backgroundColor: C.colors.background,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: C.width,
        height: C.height,
      },
      physics: {
        default: 'matter',
        matter: { gravity: { y: 1 }, debug: false },
      },
      scene: [MenuScene, ...scenes],
    });
    return Arcade.game;
  }

  return {
    config: C,
    store,
    getBest,
    saveBest,
    hashString,
    createRng,
    getPeriod,
    difficulty,
    formatScore,
    resultLine,
    copyText,
    sfx,
    fx: { pixelBurst },
    ui: { text, button, muteButton, setColors, colors },
    registerGame,
    boot,
  };
})();
