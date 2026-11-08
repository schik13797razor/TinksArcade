// ambience.js: the background sound for each skin, played live by the browser's audio
// engine (no files to load). Off until a player turns on "Background sound" in Settings,
// and it has its own volume slider there.
//
//   Tink          rain on the cottage window and slow, soft electric piano
//   Coffee Shop   mellow café jazz: electric piano, upright bass, brushes, a little record hiss
//   Fine Dining   a dinner pianist with soft strings, and now and then a glass
//
// The music is written as chords and little rules, with a bit of chance in the melody
// and the playing, so it doesn't sound like the same short loop over and over.
//
// To use a recording instead, put a looping file named ambient.mp3 in
// assets/skins/<skin>/ (keep it short, under 1 MB, and make sure the end joins the start
// smoothly). The player in arcade.js (Arcade.ambience) starts and stops these.
//
// Each recipe gets the audio engine (ctx) and an output to connect to, and returns
//   tick(now): called ten times a second, to schedule the next notes and sounds
//   stop():    stops everything it started

(() => {
  // Notes are planned this far ahead (seconds). The timer can run late in a background
  // tab, so a little headroom keeps the music from stumbling.
  const LOOKAHEAD = 1.2;

  const between = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const chance = (p) => Math.random() < p;
  const hz = (note) => 440 * Math.pow(2, (note - 69) / 12); // MIDI note number to pitch; 60 is middle C
  const loose = () => between(-0.008, 0.008); // a human hand is never exactly on the beat

  // ---------- Timing ----------
  // A beat grid: calls play(step, time) for every step, a little ahead of time.
  function grid(ctx, stepSeconds, play) {
    let next = ctx.currentTime + 0.4;
    let step = 0;
    return (now) => {
      if (next < now) {
        // The timer stalled (a hidden tab). Pick up from now rather than playing
        // every missed note at once.
        const missed = Math.ceil((now - next) / stepSeconds);
        next += missed * stepSeconds;
        step += missed;
      }
      while (next < now + LOOKAHEAD) {
        play(step, next);
        step += 1;
        next += stepSeconds;
      }
    };
  }

  // Something that happens at random gaps (raindrops, a cup set down).
  function nowAndThen(ctx, minGap, maxGap, play) {
    let next = ctx.currentTime + between(minGap, maxGap);
    return (now) => {
      if (next < now) next = now + between(0, maxGap - minGap);
      while (next < now + LOOKAHEAD) {
        play(next);
        next += between(minGap, maxGap);
      }
    };
  }

  // ---------- Building blocks ----------
  // Two seconds of noise, made once and looped. 'white' is hiss; 'pink' is softer.
  const buffers = {};
  function noise(ctx, kind) {
    const key = kind + ctx.sampleRate;
    if (buffers[key]) return buffers[key];
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'pink') {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
      } else {
        data[i] = white;
      }
    }
    buffers[key] = buffer;
    return buffer;
  }

  // A room: whatever is played into the returned node is heard as is, plus a soft
  // echo of the room around it (a reverb). The echo is made once from fading noise.
  const echoes = {};
  function room(ctx, out, { seconds, wet, tone = 3000 }) {
    const key = seconds + ':' + ctx.sampleRate;
    if (!echoes[key]) {
      const length = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
      echoes[key] = buffer;
    }
    const input = ctx.createGain();
    const echo = ctx.createConvolver();
    echo.buffer = echoes[key];
    const soften = ctx.createBiquadFilter(); // a real room swallows the highs first
    soften.type = 'lowpass';
    soften.frequency.value = tone;
    const amount = ctx.createGain();
    amount.gain.value = wet;
    input.connect(out);
    input.connect(echo).connect(soften).connect(amount).connect(out);
    return input;
  }

  // A steady noise bed through a filter (rain, record hiss). It stays at one level on
  // purpose: noise that slowly swells and fades is what sounds like ocean waves.
  function bed(ctx, out, kind, filterType, freq, q, level) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx, kind);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(out);
    src.start();
    return src;
  }

  // Turns a whole recipe up or down, so the three skins sit at about the same loudness.
  function trim(ctx, out, amount) {
    const gain = ctx.createGain();
    gain.gain.value = amount;
    gain.connect(out);
    return gain;
  }

  // Places a sound a little left or right (pan: -1 to 1), where the browser can.
  function placed(ctx, dest, pan) {
    if (!pan || !ctx.createStereoPanner) return dest;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(dest);
    return panner;
  }

  // A short burst of filtered noise: a raindrop, a brush, a hi-hat, a record crackle.
  function burst(ctx, out, at, { filterType = 'highpass', freq = 2000, length = 0.02, level = 0.2, pan = 0 }) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx, 'white');
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + Math.min(0.004, length / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter).connect(gain).connect(placed(ctx, out, pan));
    src.start(at, Math.random() * 1.5);
    src.stop(at + length + 0.05);
  }

  // A small bright ring: a cup on a saucer, a wine glass.
  function ting(ctx, out, at, freq, length, level, pan = 0) {
    const dest = placed(ctx, out, pan);
    for (const [mul, share] of [[1, 1], [2.76, 0.5], [5.4, 0.25]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * mul;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level * share, at + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length / mul);
      osc.connect(gain).connect(dest);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }
  }

  // ---------- Instruments ----------
  // A keyboard note. One tone shapes another (FM), and the shaping fades fast, so each
  // note starts bright and settles into a round, mellow sound.
  //   bright: how bright the start is (about 1 for an electric piano, 2 for a piano)
  //   decay:  how slowly the note fades while held (seconds)
  function keys(ctx, dest, at, note, { length = 1.5, level = 0.08, bright = 1, decay = 1.2, tone = 2400, pan = 0 }) {
    const f = hz(note);
    const carrier = ctx.createOscillator();
    carrier.frequency.value = f;
    const shaper = ctx.createOscillator();
    shaper.frequency.value = f;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(f * bright, at);
    depth.gain.setTargetAtTime(f * bright * 0.12, at, 0.18);
    shaper.connect(depth).connect(carrier.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = tone;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(level, at + 0.006);
    amp.gain.setTargetAtTime(0, at + 0.006, decay);
    amp.gain.setTargetAtTime(0, at + length, 0.15); // let go of the key
    carrier.connect(filter).connect(amp).connect(placed(ctx, dest, pan));

    for (const osc of [carrier, shaper]) {
      osc.start(at);
      osc.stop(at + length + 1);
    }
  }

  // A soft held chord, like strings far back in the room.
  function pad(ctx, dest, at, notes, { length, level, tone = 900 }) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = tone;
    filter.Q.value = 0.4;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(level, at + Math.min(1.5, length / 3));
    amp.gain.setTargetAtTime(0, at + length, 0.7);
    filter.connect(amp).connect(dest);
    for (const note of notes) {
      for (const cents of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(note);
        osc.detune.value = cents;
        osc.connect(filter);
        osc.start(at);
        osc.stop(at + length + 4);
      }
    }
  }

  // A plucked bass note, round like an upright bass.
  function bass(ctx, dest, at, note, { length = 0.8, level = 0.2 }) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(level, at + 0.012);
    amp.gain.setTargetAtTime(level * 0.25, at + 0.012, 0.3);
    amp.gain.setTargetAtTime(0, at + length, 0.06);
    filter.connect(amp).connect(dest);
    // The sine is the body; the triangle adds the overtones that small speakers can play.
    for (const [type, share] of [['sine', 1], ['triangle', 0.5]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz(note);
      const g = ctx.createGain();
      g.gain.value = share;
      osc.connect(g).connect(filter);
      osc.start(at);
      osc.stop(at + length + 0.5);
    }
  }

  // A soft, felt kick drum.
  function kick(ctx, dest, at, level) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(level, at + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(amp).connect(dest);
    osc.start(at);
    osc.stop(at + 0.35);
  }

  // A drop landing in the water on the window sill: a tiny rising "plip".
  function plip(ctx, dest, at, level, pan) {
    const osc = ctx.createOscillator();
    const from = between(700, 1200);
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(from * 2.2, at + 0.04);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(level, at + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    osc.connect(amp).connect(placed(ctx, dest, pan));
    osc.start(at);
    osc.stop(at + 0.08);
  }

  // Strums a chord: the notes land a hair apart, as a hand plays them.
  function strum(ctx, dest, at, notes, options) {
    notes.forEach((note, i) => keys(ctx, dest, at + i * 0.018 + loose(), note, options));
  }

  // A melody that wanders: mostly small steps from the last note, now and then a rest.
  function wanderer(scale, start) {
    let index = scale.indexOf(start);
    return () => {
      index = Math.max(0, Math.min(scale.length - 1, index + pick([-2, -1, -1, 1, 1, 2])));
      return scale[index];
    };
  }

  // ---------- Tink: rain on the window, soft keys in a warm cottage ----------
  // Slow (62 beats a minute), in C major, one chord a bar: [bass note, chord notes].
  const COTTAGE_CHORDS = [
    [41, [53, 57, 60, 64]], // Fmaj7
    [40, [55, 59, 62, 64]], // Em7
    [38, [53, 57, 60, 64]], // Dm9
    [36, [55, 59, 62, 64]], // Cmaj9
    [45, [55, 59, 60, 64]], // Am9
    [41, [55, 57, 60, 64]], // Fmaj9
    [38, [53, 57, 60, 62]], // Dm7
    [43, [53, 55, 60, 62]], // G7sus4
  ];

  function cottage(ctx, speakers) {
    const out = trim(ctx, speakers, 1.7);
    const space = room(ctx, out, { seconds: 2.6, wet: 0.45, tone: 2200 });
    const ep = { bright: 0.9, decay: 1.6, tone: 1800 };
    const melody = wanderer([69, 72, 74, 76, 79, 81], 76);
    const eighth = 60 / 62 / 2;

    // Rain: a steady soft patter, plus single drops on the glass and the sill.
    const rain = bed(ctx, out, 'pink', 'bandpass', 1400, 0.35, 0.11);
    const drops = nowAndThen(ctx, 0.015, 0.09, (at) => burst(ctx, out, at, {
      filterType: 'bandpass', freq: between(2500, 6000), length: between(0.004, 0.012),
      level: between(0.006, 0.03), pan: between(-0.6, 0.6),
    }));
    const plips = nowAndThen(ctx, 1.2, 4, (at) => plip(ctx, out, at, between(0.008, 0.02), between(-0.5, 0.5)));

    const music = grid(ctx, eighth, (step, at) => {
      const [root, chord] = COTTAGE_CHORDS[Math.floor(step / 8) % COTTAGE_CHORDS.length];
      const pos = step % 8;
      if (pos === 0) {
        bass(ctx, space, at, root + 12, { length: eighth * 7, level: 0.07 });
        strum(ctx, space, at, chord, { ...ep, length: eighth * 7, level: 0.045 });
      }
      // Halfway through the bar, the top of the chord again, softly, some of the time.
      if (pos === 4 && chance(0.5)) strum(ctx, space, at, chord.slice(2), { ...ep, length: eighth * 3, level: 0.03 });
      // A sparse melody on top.
      if ((pos === 2 || pos === 5 || pos === 6) && chance(0.28)) {
        keys(ctx, space, at + loose(), melody(), { ...ep, length: eighth * 2.5, level: 0.04, pan: 0.2 });
      }
    });

    return {
      tick(now) {
        drops(now);
        plips(now);
        music(now);
      },
      stop() {
        try { rain.stop(); } catch (e) { /* already stopped */ }
      },
    };
  }

  // ---------- Coffee Shop: mellow café jazz ----------
  // 76 beats a minute with a lazy swing, in F major.
  const CAFE_CHORDS = [
    [43, [58, 62, 65, 69]], // Gm9
    [36, [58, 62, 64, 69]], // C13
    [41, [57, 60, 64, 67]], // Fmaj9
    [38, [53, 57, 60, 64]], // Dm9
    [46, [57, 62, 65, 69]], // Bbmaj7
    [45, [55, 61, 64, 67]], // A7
    [38, [53, 57, 60, 64]], // Dm9
    [43, [53, 59, 64, 69]], // G13
  ];

  function cafe(ctx, out) {
    const space = room(ctx, out, { seconds: 1.6, wet: 0.22, tone: 3500 });
    const ep = { bright: 1.1, decay: 1.2, tone: 2600 };
    const beat = 60 / 76;
    const swing = beat * 0.16; // the second eighth of each beat lands late: that's the swing
    const fill = wanderer([72, 74, 77, 79, 81], 77);

    // A little record hiss and crackle, and a cup set down now and then.
    const hiss = bed(ctx, out, 'pink', 'highpass', 3500, 0.5, 0.03);
    const crackle = nowAndThen(ctx, 0.12, 0.9, (at) => burst(ctx, out, at, {
      freq: between(1500, 4000), length: between(0.002, 0.006), level: between(0.01, 0.05),
    }));
    const cups = nowAndThen(ctx, 7, 16, (at) => {
      const pan = between(-0.7, 0.7);
      ting(ctx, space, at, between(1800, 2600), 0.35, 0.012, pan);
      if (chance(0.4)) ting(ctx, space, at + between(0.08, 0.16), between(1800, 2600), 0.3, 0.008, pan);
    });

    const music = grid(ctx, beat / 2, (step, straight) => {
      const pos = step % 8;
      const at = straight + (pos % 2 ? swing : 0);
      const bar = Math.floor(step / 8);
      const [root, chord] = CAFE_CHORDS[bar % CAFE_CHORDS.length];
      const [nextRoot] = CAFE_CHORDS[(bar + 1) % CAFE_CHORDS.length];

      // Drums, kept far back: a soft kick, brushes on 2 and 4, a light hi-hat.
      if (pos === 0 || (pos === 5 && chance(0.6))) kick(ctx, out, at, 0.11);
      if (pos === 2 || pos === 6) burst(ctx, space, at, { filterType: 'bandpass', freq: 2600, length: 0.16, level: 0.03 });
      burst(ctx, out, at, { freq: 7000, length: 0.025, level: pos % 2 ? 0.006 : 0.011, pan: 0.3 });

      // Bass: the root on 1, the fifth on 3, and sometimes a step leading into the next chord.
      if (pos === 0) bass(ctx, out, at, root, { length: beat * 1.6, level: 0.16 });
      if (pos === 4) bass(ctx, out, at, chance(0.7) ? root + 7 : root + 12, { length: beat * 1.2, level: 0.13 });
      if (pos === 7 && chance(0.35)) bass(ctx, out, at, nextRoot - 1, { length: beat * 0.4, level: 0.1 });

      // Electric piano: the chord on 1 and again just after 2.
      if (pos === 0) strum(ctx, space, at, chord, { ...ep, length: beat * 1.4, level: 0.04 });
      if (pos === 3 && chance(0.75)) strum(ctx, space, at, chord, { ...ep, length: beat * 0.7, level: 0.03 });
      if ((pos === 5 || pos === 7) && chance(0.15)) {
        keys(ctx, space, at + loose(), fill(), { ...ep, length: beat * 0.6, level: 0.03, pan: -0.2 });
      }
    });

    return {
      tick(now) {
        crackle(now);
        cups(now);
        music(now);
      },
      stop() {
        try { hiss.stop(); } catch (e) { /* already stopped */ }
      },
    };
  }

  // ---------- Fine Dining: a dinner pianist ----------
  // A slow waltz (72 beats a minute, three to a bar) in A minor:
  // [bass note, the notes the left hand rolls through].
  const DINING_CHORDS = [
    [45, [52, 55, 59, 60, 64]], // Am9
    [38, [50, 57, 60, 64, 65]], // Dm9
    [43, [50, 53, 59, 64, 67]], // G13
    [36, [48, 52, 55, 59, 62]], // Cmaj9
    [41, [48, 52, 57, 60, 64]], // Fmaj7
    [47, [50, 53, 57, 59, 62]], // Bm7b5
    [40, [47, 50, 56, 59, 62]], // E7
    [45, [52, 57, 59, 60, 64]], // Am(add9)
  ];
  const ROLLS = [[0, 1, 2, 3, 4], [0, 2, 4, 3, 1], [0, 1, 3, 4, 2]];

  function dining(ctx, speakers) {
    const out = trim(ctx, speakers, 1.6);
    const space = room(ctx, out, { seconds: 3, wet: 0.4, tone: 3200 });
    const piano = { bright: 1.8, tone: 3200 };
    const eighth = 60 / 72 / 2;
    const bar = eighth * 6;
    let roll = ROLLS[0];

    // Now and then, a glass across the room.
    const glasses = nowAndThen(ctx, 14, 32, (at) => ting(ctx, space, at, between(2800, 3600), 0.7, 0.01, between(-0.8, 0.8)));

    const music = grid(ctx, eighth, (step, at) => {
      const [root, notes] = DINING_CHORDS[Math.floor(step / 6) % DINING_CHORDS.length];
      const pos = step % 6;
      if (pos === 0) {
        roll = pick(ROLLS);
        keys(ctx, space, at, root, { ...piano, length: bar, level: 0.07, decay: 2.4, pan: -0.15 });
        pad(ctx, space, at, notes.slice(1, 4).map((n) => n + 12), { length: bar, level: 0.012 });
        // The right hand: a held melody note on some bars, from the chord.
        if (chance(0.55)) {
          const tops = notes.map((n) => n + 24).filter((n) => n >= 69 && n <= 84);
          keys(ctx, space, at + 0.01, pick(tops), { ...piano, length: eighth * 4, level: 0.045, decay: 1.6, pan: 0.15 });
        }
      } else {
        const note = notes[roll[pos - 1]];
        keys(ctx, space, at + loose(), note, { ...piano, length: eighth * 3, level: 0.032, decay: 1.4 });
      }
    });

    return {
      tick(now) {
        glasses(now);
        music(now);
      },
      stop() {},
    };
  }

  Arcade.ambience.register('tink', cottage);
  Arcade.ambience.register('coffee-shop', cafe);
  Arcade.ambience.register('fine-dining', dining);
})();
