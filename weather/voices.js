/* ==========================================================================
   THE VOICE BOX — casting browser voices for the presenters.

   Browsers ship anything from one robotic voice to dozens of excellent
   "natural" ones. Rather than warping a single voice with extreme pitch
   (which is what makes speech synthesis grating), we:
     1. rank every English voice on the device by quality and accent,
     2. give each character a *different* voice of the right gender,
     3. keep pitch and speed close to natural,
     4. tidy the text so it's pronounced like a person would say it,
     5. speak sentence by sentence, so mouths move only while talking.
   ========================================================================== */

const VoiceBox = (() => {
  const supported = 'speechSynthesis' in window;
  let voices = [];
  const listeners = [];

  /* Per-character casting notes: gender, preferred voice names (best first),
     and a gentle nudge to pitch/speed. Kept close to 1.0 on purpose. */
  const PROFILES = {
    drench:    { gender: 'male',   pitch: 0.94, rate: 0.95, prefer: ['Ryan', 'George', 'Daniel', 'Arthur', 'Thomas', 'Oliver'] },
    arabella:  { gender: 'female', pitch: 1.03, rate: 0.98, prefer: ['Sonia', 'Libby', 'Serena', 'Kate', 'Stephanie', 'Martha', 'Olivia'] },
    wilf:      { gender: 'male',   pitch: 1.0,  rate: 1.04, prefer: ['Alfie', 'Thomas', 'Elliot', 'Daniel', 'Noah'] },
    captain:   { gender: 'male',   pitch: 1.05, rate: 1.08, prefer: ['Oliver', 'Elliot', 'Arthur', 'Noah', 'George'] },
    nimbus:    { gender: 'male',   pitch: 1.08, rate: 1.06, prefer: ['Noah', 'Ethan', 'Thomas', 'Elliot', 'Arthur'] },
    edna:      { gender: 'female', pitch: 1.08, rate: 1.03, prefer: ['Hollie', 'Abbi', 'Hazel', 'Martha', 'Susan', 'Bella', 'Fiona'] },
    smethwick: { gender: 'male',   pitch: 0.9,  rate: 0.9,  prefer: ['Ethan', 'Daniel', 'Arthur', 'George', 'Ryan'] },
  };

  const SAMPLES = {
    drench: "I am Lord Drench, and I shall be your forecaster. Regrettably.",
    arabella: "Lady Arabella, darling. Do try to keep up.",
    wilf: "Cor blimey. I've got a brilliant idea, m'lord.",
    captain: "Captain Gale-Force reporting! Morale is magnificent!",
    nimbus: "Clouds, you see, are approximately eleven per cent sheep.",
    edna: "I want to complain about the rain, young man. In writing.",
    smethwick: "This announcement has been an announcement.",
  };

  const FEMALE = /female|sonia|libby|abbi|bella|hollie|maisie|olivia|hazel|susan|serena|kate|martha|stephanie|fiona|moira|amy|emma|jenny|karen|samantha|victoria|tessa|catherine|kathy|zira|aria|natasha|clara|sienna|mia|ava|allison|joanna|kimberly|salli|emily/i;
  const MALE = /\bmale\b|ryan|alfie|elliot|ethan|noah|oliver|thomas|george|daniel|arthur|james|brian|david|mark|guy|rishi|alex|liam|william|gordon|lee|aaron|fred|matthew|joey|justin|reed|eddy|rocko|grandpa/i;
  const NOVELTY = /espeak|\bfred\b|zarvox|bad news|bells|bubbles|trinoids|whisper|albert|jester|cellos|organ|boing|superstar|wobble|bahh|junior|ralph|kathy|good news|deranged|hysterical|pipe organ|grandma|grandpa|rocko|shelley|sandy|flo|eddy|reed/i;
  const QUALITY = /natural|neural|online|premium|enhanced|siri/i;

  function genderOf(v) {
    const n = v.name;
    if (/female/i.test(n) || (FEMALE.test(n) && !/\bmale\b/i.test(n))) return 'female';
    if (MALE.test(n)) return 'male';
    return null;
  }

  function isEnglish(v) { return /^en([-_]|$)/i.test(v.lang); }

  function quality(v) {
    let q = 0;
    if (QUALITY.test(v.name)) q += 40;
    if (/google/i.test(v.name)) q += 22;
    if (NOVELTY.test(v.name)) q -= 200;
    if (/compact/i.test(v.name)) q -= 15;
    return q;
  }

  function score(v, profile) {
    let s = quality(v);
    if (/en[-_]GB/i.test(v.lang)) s += 60;
    else if (/en[-_](IE|AU|NZ)/i.test(v.lang)) s += 25;
    else if (isEnglish(v)) s += 10;
    const g = genderOf(v);
    if (g === profile.gender) s += 30;
    else if (g) s -= 45;
    const idx = profile.prefer.findIndex(p => new RegExp(`\\b${p}\\b`, 'i').test(v.name));
    if (idx >= 0) s += 24 - idx * 3;
    return s;
  }

  function load() {
    if (!supported) return;
    voices = speechSynthesis.getVoices().filter(isEnglish);
    listeners.forEach(fn => fn());
  }
  if (supported) {
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
    if (!speechSynthesis.addEventListener) speechSynthesis.onvoiceschanged = load;
  }

  function overrides() {
    try { return JSON.parse(localStorage.getItem('twu.voiceCast') || '{}'); } catch { return {}; }
  }
  function setOverride(id, uri) {
    const o = overrides();
    if (uri) o[id] = uri; else delete o[id];
    try { localStorage.setItem('twu.voiceCast', JSON.stringify(o)); } catch { /* fine */ }
  }

  /* Cast a set of characters at once so nobody shares a voice if avoidable. */
  function cast(ids) {
    const result = {};
    const used = new Set();
    const o = overrides();
    // honour manual choices first
    for (const id of ids) {
      const v = o[id] && voices.find(x => x.voiceURI === o[id]);
      if (v) { result[id] = v; used.add(v.voiceURI); }
    }
    for (const id of ids) {
      if (result[id]) continue;
      const p = PROFILES[id];
      const ranked = voices.slice().sort((a, b) => score(b, p) - score(a, p));
      // Prefer a fresh voice, but never one much worse than the best: a good
      // voice shared (with a slight pitch change) beats a bad one.
      const best = ranked[0] ? score(ranked[0], p) : 0;
      result[id] = ranked.find(v => !used.has(v.voiceURI) && score(v, p) >= best - 40) || ranked[0] || null;
      if (result[id]) used.add(result[id].voiceURI);
    }
    return result;
  }

  /* When two characters end up sharing a voice (tiny voice sets), separate
     them with a modest pitch difference rather than a cartoonish one. */
  function pitchFor(id, castMap) {
    const p = PROFILES[id];
    const v = castMap[id];
    const sharers = Object.keys(castMap).filter(k => castMap[k] && v && castMap[k].voiceURI === v.voiceURI);
    if (sharers.length < 2) return p.pitch;
    const spread = [0, 0.14, -0.12];
    return Math.min(1.3, Math.max(0.75, p.pitch + spread[sharers.indexOf(id)]));
  }

  /* Make the script sound like speech rather than text. */
  function speakable(text) {
    return text
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/(-?\d+)°C/g, (m, n) => `${n.replace('-', 'minus ')} degrees`)
      .replace(/(-?\d+)°F/g, (m, n) => `${n.replace('-', 'minus ')} degrees`)
      .replace(/(\d+)\s?%/g, '$1 per cent')
      .replace(/\bmph\b/g, 'miles an hour')
      .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (m, h, mm) => {
        const hh = +h % 12 || 12;
        return `${hh}${mm === '00' ? '' : ':' + mm} ${+h < 12 ? 'a m' : 'p m'}`;
      })
      .replace(/\bm'lord\b/gi, 'my lord').replace(/\bm'lady\b/gi, 'my lady')
      .replace(/'eck\b/g, 'eck').replace(/'em\b/g, 'em')
      .replace(/\b([A-Z])\1{3,}([A-Z]*)\b/g, (m) => m[0] + m.slice(1).toLowerCase().replace(/(.)\1{2,}/g, '$1$1'))
      .replace(/\b[A-Z]{4,}\b/g, (m) => m[0] + m.slice(1).toLowerCase())
      .replace(/\s*—\s*/g, ', ')
      .replace(/\.\.\./g, '…')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sentences(text) {
    const parts = text.match(/[^.!?…]+[.!?…]+["'’)]*|[^.!?…]+$/g) || [text];
    // glue very short fragments onto the next one so delivery doesn't stutter
    const out = [];
    for (const p of parts.map(s => s.trim()).filter(Boolean)) {
      if (out.length && out[out.length - 1].length < 10 && !/[!?]$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + p;
      else out.push(p);
    }
    return out;
  }

  /* Speak a line for a character. Returns a promise that resolves when done
     (or is cancelled). onSpeaking(bool) lets the caller animate the mouth. */
  function say(id, text, { castMap, speed = 1, onSpeaking } = {}) {
    return new Promise((resolve) => {
      if (!supported) return resolve();
      const map = castMap || cast([id]);
      const v = map[id];
      const p = PROFILES[id];
      const chunks = sentences(speakable(text));
      let i = 0, settled = false;
      const done = () => { if (settled) return; settled = true; onSpeaking && onSpeaking(false); resolve(); };
      const nextChunk = () => {
        if (settled) return;
        if (i >= chunks.length) return done();
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
        u.pitch = pitchFor(id, map);
        u.rate = Math.min(1.6, Math.max(0.6, p.rate * speed));
        u.volume = 1;
        let ended = false;
        const end = () => { if (ended) return; ended = true; onSpeaking && onSpeaking(false); clearTimeout(guard); setTimeout(nextChunk, 90); };
        u.onstart = () => onSpeaking && onSpeaking(true);
        u.onend = end;
        u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') done(); else end(); };
        // Some browsers occasionally forget to fire onend.
        const guard = setTimeout(end, 2500 + u.text.length * 110 / u.rate);
        speechSynthesis.speak(u);
      };
      say.cancelCurrent = done;
      nextChunk();
    });
  }

  function cancel() {
    if (!supported) return;
    say.cancelCurrent && say.cancelCurrent();
    speechSynthesis.cancel();
  }

  /* Is anything decent installed? Used to show a helpful tip. */
  function hasGoodVoices() {
    return voices.some(v => quality(v) >= 20 && /en[-_]GB/i.test(v.lang));
  }

  function label(v) {
    const accent = /en[-_]GB/i.test(v.lang) ? 'British' : /en[-_]IE/i.test(v.lang) ? 'Irish' : /en[-_]AU/i.test(v.lang) ? 'Australian' : /en[-_]US/i.test(v.lang) ? 'American' : v.lang;
    const name = v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/Online|Natural|-\s*English.*$/gi, '').trim();
    return `${name} · ${accent}${quality(v) >= 20 ? ' ★' : ''}`;
  }

  return {
    supported, PROFILES, SAMPLES,
    get voices() { return voices.slice().sort((a, b) => quality(b) + (/en[-_]GB/i.test(b.lang) ? 60 : 0) - quality(a) - (/en[-_]GB/i.test(a.lang) ? 60 : 0)); },
    onChange: (fn) => listeners.push(fn),
    cast, say, cancel, speakable, hasGoodVoices, label, setOverride, overrides,
  };
})();
