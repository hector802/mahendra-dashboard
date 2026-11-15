/* ==========================================================================
   THE DIRECTOR — fetches the weather, writes today's film, and runs the show.
   Weather: Open-Meteo (free, no key). Places: Open-Meteo geocoding.
   ========================================================================== */

(() => {
  'use strict';

  /* ---------------- tiny helpers ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: never mind */ } },
  };

  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  /* ---------------- weather vocabulary ---------------- */
  const WMO = {
    0: ['Clear sky', 'clear skies'], 1: ['Mainly clear', 'mostly clear skies'], 2: ['Partly cloudy', 'sunny spells and the odd cloud'],
    3: ['Overcast', 'grey, overcast skies'], 45: ['Fog', 'fog'], 48: ['Freezing fog', 'freezing fog'],
    51: ['Light drizzle', 'light drizzle'], 53: ['Drizzle', 'drizzle'], 55: ['Heavy drizzle', 'heavy drizzle'],
    56: ['Freezing drizzle', 'freezing drizzle'], 57: ['Freezing drizzle', 'heavy freezing drizzle'],
    61: ['Light rain', 'light rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'heavy rain'],
    66: ['Freezing rain', 'freezing rain'], 67: ['Freezing rain', 'heavy freezing rain'],
    71: ['Light snow', 'light snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'heavy snow'], 77: ['Snow grains', 'snow grains'],
    80: ['Light showers', 'light showers'], 81: ['Showers', 'showers'], 82: ['Violent showers', 'violent downpours'],
    85: ['Snow showers', 'snow showers'], 86: ['Heavy snow showers', 'heavy snow showers'],
    95: ['Thunderstorm', 'thunderstorms'], 96: ['Thunderstorm & hail', 'thunderstorms with hail'], 99: ['Thunderstorm & hail', 'violent thunderstorms with hail'],
  };
  function category(code) {
    if (code <= 1) return 'clear';
    if (code <= 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'thunder';
    return 'cloudy';
  }
  const describe = (code) => WMO[code] || ['Weather', 'some weather'];
  const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const COMPASS_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const compass = (deg, short) => (short ? COMPASS_SHORT : COMPASS)[Math.round(((deg % 360) / 45)) % 8];

  /* ---------------- icons ---------------- */
  function icon(code, isDay = true, size = 40) {
    const cat = category(code);
    const sun = '<circle cx="20" cy="18" r="8" fill="#f6c34a"/><g stroke="#f6c34a" stroke-width="2.4" stroke-linecap="round"><path d="M20 4v4M20 28v4M6 18h4M30 18h4M10 8l3 3M27 25l3 3M30 8l-3 3M13 25l-3 3"/></g>';
    const moon = '<path d="M24 6a12 12 0 1 0 10 18A10 10 0 0 1 24 6z" fill="#e9dfc7"/>';
    const cloud = (fill = '#d9dee3', y = 0) => `<path transform="translate(0 ${y})" d="M12 32h18a7 7 0 0 0 0-14 10 10 0 0 0-19-2 7.5 7.5 0 0 0 1 16z" fill="${fill}"/>`;
    let body = '';
    if (cat === 'clear') body = isDay ? sun : moon;
    else if (cat === 'cloudy') body = code === 2 ? `<g transform="translate(-4 -4) scale(.8)">${isDay ? sun : moon}</g>${cloud()}` : cloud('#b8c0c8');
    else if (cat === 'fog') body = '<g stroke="#c9ced2" stroke-width="3" stroke-linecap="round"><path d="M6 14h28M10 20h24M6 26h26M12 32h20"/></g>';
    else if (cat === 'drizzle') body = cloud('#b8c0c8', -4) + '<g fill="#7fb2e5"><circle cx="14" cy="34" r="1.6"/><circle cx="21" cy="36" r="1.6"/><circle cx="28" cy="34" r="1.6"/></g>';
    else if (cat === 'rain') body = cloud('#9aa4ae', -4) + '<g stroke="#5ea0e6" stroke-width="2.4" stroke-linecap="round"><path d="M13 31l-2 6M20 31l-2 6M27 31l-2 6"/></g>';
    else if (cat === 'snow') body = cloud('#c9d1d8', -4) + '<g fill="#fff" stroke="#9fb0c0" stroke-width=".8"><circle cx="13" cy="34" r="2.2"/><circle cx="21" cy="37" r="2.2"/><circle cx="29" cy="34" r="2.2"/></g>';
    else if (cat === 'thunder') body = cloud('#7c8590', -4) + '<path d="M21 26l-5 8h5l-3 7 8-10h-5l3-5z" fill="#f6c34a"/>';
    return `<svg class="wx-icon" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`;
  }

  /* ---------------- URL options (used for Reels and experiments) ----------------
     ?reel           vertical 9:16 short cut for Instagram/TikTok
     ?cast=h,s,g     force host, sidekick and guest (e.g. drench,wilf,edna)
     ?setting=pier   force the set (studio, castle, field, ministry, pier, parlour)
     ?gag=fish       force an interruption (fish, sheep, shake, lights, weasels, trousers, none)
     ?take=3         pick a different take of the jokes
     ?place=Britain  override the place name used in the script            */
  const params = new URLSearchParams(location.search);
  const REEL = params.has('reel');
  const OPT = {
    cast: (params.get('cast') || '').split(',').map(x => x.trim()).filter(id => CAST[id]),
    setting: SETTINGS.find(x => x.id === params.get('setting')),
    gag: params.get('gag'),
    place: params.get('place'),
  };
  const GAGS = ['fish', 'sheep', 'shake', 'lights', 'weasels', 'trousers'];
  if (REEL) document.body.classList.add('reel');

  /* ---------------- state ---------------- */
  const state = {
    place: store.get('twu.place', { name: 'London', admin: 'England', lat: 51.5074, lon: -0.1278 }),
    unit: store.get('twu.unit', 'C'),
    voice: store.get('twu.voice', false),
    speed: store.get('twu.speed', 1),
    cc: store.get('twu.cc', true),
    take: +params.get('take') || 0,
    data: null,
    demo: false,
  };

  const fmtT = (c) => state.unit === 'F' ? `${Math.round(c * 9 / 5 + 32)}°F` : `${Math.round(c)}°C`;
  const fmtNum = (c) => state.unit === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c);

  /* ---------------- fetching ---------------- */
  async function fetchWeather(place) {
    const params = new URLSearchParams({
      latitude: place.lat, longitude: place.lon, timezone: 'auto', wind_speed_unit: 'mph', forecast_days: '7',
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl,cloud_cover',
      hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Weather service said ${res.status}`);
    return res.json();
  }

  function demoData() {
    // A dramatic reconstruction, used when the real weather can't be reached.
    const now = new Date(); now.setMinutes(0, 0, 0);
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const hourly = { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [], is_day: [] };
    for (let i = -now.getHours(); i < 7 * 24 - now.getHours(); i++) {
      const d = new Date(now.getTime() + i * 3600000);
      const h = d.getHours();
      hourly.time.push(iso(d));
      hourly.temperature_2m.push(9 + 4 * Math.sin((h - 9) / 24 * Math.PI * 2) + Math.sin(i / 17));
      hourly.precipitation_probability.push(Math.round(40 + 40 * Math.sin(i / 9)));
      hourly.weather_code.push([61, 3, 2, 80, 51, 63][Math.floor(i / 8 + 99) % 6]);
      hourly.is_day.push(h >= 7 && h < 17 ? 1 : 0);
    }
    const days = [...Array(7)].map((_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d; });
    return {
      current: {
        time: iso(now), temperature_2m: 9.4, apparent_temperature: 6.1, relative_humidity_2m: 87, is_day: now.getHours() >= 7 && now.getHours() < 17 ? 1 : 0,
        weather_code: 61, wind_speed_10m: 17, wind_direction_10m: 230, wind_gusts_10m: 31, precipitation: 0.4, pressure_msl: 1004, cloud_cover: 92,
      },
      hourly,
      daily: {
        time: days.map(d => iso(d).slice(0, 10)),
        weather_code: [61, 3, 80, 2, 63, 1, 51],
        temperature_2m_max: [11, 12, 10, 13, 9, 14, 12], temperature_2m_min: [6, 7, 4, 6, 5, 8, 7],
        precipitation_probability_max: [80, 35, 65, 20, 90, 10, 55], precipitation_sum: [4.2, 0.3, 2.1, 0, 7.8, 0, 1.1],
        sunrise: days.map(d => iso(d).slice(0, 10) + 'T07:21'), sunset: days.map(d => iso(d).slice(0, 10) + 'T16:12'),
        uv_index_max: [1, 1.5, 1, 2, 0.8, 2.4, 1.2], wind_speed_10m_max: [19, 14, 22, 9, 26, 8, 15], wind_gusts_10m_max: [34, 25, 41, 18, 47, 15, 29],
      },
    };
  }

  /* ---------------- turn raw data into a story-friendly summary ---------------- */
  function summarise(d) {
    const c = d.current, day = d.daily;
    const code = c.weather_code;
    let cat = category(code);
    const isDay = !!c.is_day;
    if (cat === 'clear' && !isDay) cat = 'night';
    const t = c.temperature_2m;
    const band = t <= 1 ? 'freezing' : t < 8 ? 'cold' : t < 16 ? 'mild' : t < 23 ? 'warm' : 'hot';
    const hour = parseInt(c.time.slice(11, 13), 10);
    const tod = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 23 ? 'evening' : 'night';
    const windy = c.wind_speed_10m >= 22 || c.wind_gusts_10m >= 38;

    const dayName = (i) => new Date(day.time[i] + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long' });
    const score = (i) => -Math.abs(day.temperature_2m_max[i] - 19) - (day.precipitation_probability_max[i] ?? 0) * 0.15
      - (['rain', 'thunder', 'snow'].includes(category(day.weather_code[i])) ? 6 : 0) - day.wind_speed_10m_max[i] * 0.1;
    const later = [2, 3, 4, 5, 6].filter(i => i < day.time.length);
    const ranked = later.slice().sort((a, b) => score(b) - score(a));

    return {
      code, cat, isDay, band, tod, windy, hour,
      baseCat: category(code),
      temp: t, feels: c.apparent_temperature,
      hi: day.temperature_2m_max[0], lo: day.temperature_2m_min[0],
      wind: Math.round(c.wind_speed_10m), gust: Math.round(c.wind_gusts_10m), windDeg: c.wind_direction_10m,
      hum: Math.round(c.relative_humidity_2m), pressure: Math.round(c.pressure_msl),
      pop: day.precipitation_probability_max[0] ?? 0, rainSum: day.precipitation_sum[0] ?? 0,
      uv: Math.round((day.uv_index_max[0] ?? 0) * 10) / 10,
      sunrise: day.sunrise[0].slice(11, 16), sunset: day.sunset[0].slice(11, 16),
      sunriseTomorrow: (day.sunrise[1] || day.sunrise[0]).slice(11, 16),
      tCode: day.weather_code[1], tHi: day.temperature_2m_max[1], tLo: day.temperature_2m_min[1],
      tPop: day.precipitation_probability_max[1] ?? 0,
      bestDay: ranked.length ? dayName(ranked[0]) : 'Thursday',
      worstDay: ranked.length ? dayName(ranked[ranked.length - 1]) : 'Monday',
      gustMax: Math.round(day.wind_gusts_10m_max[0] ?? c.wind_gusts_10m),
    };
  }

  /* ---------------- the writers' room: build today's script ---------------- */
  const EPOCH = Date.UTC(1954, 0, 11); // the first in-vision TV weather forecast in Britain

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function episodeNumber() {
    const d = new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000) + 1;
  }

  function writeFilm(wx, place) {
    const ep = episodeNumber();
    const seedFn = hashStr(`${todayKey()}|${state.take}|${place.name}`);
    const rng = mulberry32(seedFn());

    const hostId = OPT.cast[0] || (ep % 2 ? 'drench' : 'arabella');
    const sideId = OPT.cast[1] || pick(rng, ['wilf', 'captain']);
    const guestPool = ['nimbus', 'edna', 'smethwick', 'captain', 'arabella', 'drench'].filter(g => g !== sideId && g !== hostId);
    const guestId = OPT.cast[2] || pick(rng, guestPool);
    const setting = OPT.setting || pick(rng, SETTINGS);
    const host = CAST[hostId], side = CAST[sideId], guest = CAST[guestId];

    const titleCat = wx.cat;
    const title = pick(rng, TITLES[titleCat] || TITLES.cloudy);

    const tokens = {
      city: place.name,
      greeting: pick(rng, GREETINGS[wx.tod]),
      H: host.short, Hfull: host.name,
      S: side.name, Sfirst: side.first,
      G: guest.short, Gfull: guest.name,
      Hhon: host.honorific[side.kind],
      Hyoung: host.young,
      temp: fmtT(wx.temp), feels: fmtT(wx.feels), hi: fmtT(wx.hi), lo: fmtT(wx.lo),
      wind: wx.wind, gust: wx.gust, windDir: compass(wx.windDeg), hum: wx.hum, pop: wx.pop, uv: wx.uv,
      sunset: wx.sunset, sunrise: wx.sunriseTomorrow,
      tCond: describe(wx.tCode)[1], tHi: fmtT(wx.tHi), tLo: fmtT(wx.tLo), tPop: wx.tPop,
      bestDay: wx.bestDay, worstDay: wx.worstDay,
    };
    const fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => {
      if (k === 'Sexclaim') return pick(rng, side.exclaim);
      if (side.words && side.words[k]) return side.words[k];
      return tokens[k] != null ? tokens[k] : m;
    });

    const lines = [];
    const add = (who, text, action) => lines.push({ who, text: fill(text), action });
    const addBlock = (block) => block.forEach(([who, text, action]) => add(who, text, action));

    const g = GUESTS[guestId];
    let gCat = wx.cat;
    if (wx.windy && ['clear', 'cloudy', 'night'].includes(gCat)) gCat = 'wind';
    const gag = OPT.gag === 'none' ? null
      : GAGS.includes(OPT.gag) ? INTERRUPTIONS[GAGS.indexOf(OPT.gag)]
      : (rng() < 0.55 ? pick(rng, INTERRUPTIONS) : null);

    if (REEL) {
      // The short cut: straight into the joke, one guest, one gag, out.
      addBlock(pick(rng, CONDITIONS[wx.cat] || CONDITIONS.cloudy));
      add('H', `As for the temperature: ${pick(rng, TEMP_QUIPS[wx.band])}`);
      if (gag) addBlock(gag);
      add('N', pick(rng, g.enter), 'enter');
      add('G', g.lines[gCat] || g.lines[wx.baseCat] || g.lines.cloudy);
      const [ask, answer] = pick(rng, g.retort).split('|');
      add('H', ask);
      add('G', answer);
      add('N', `[Exit ${guest.short.toUpperCase()}]`, 'exit');
      add('H', pick(rng, ADVICE[adviceKeys(wx)[0]]));
      addBlock(pick(rng, CLOSINGS.filter(b => b.length <= 3)));
      return { ep, title, setting, host, side, guest, lines, credit: pick(rng, CREDITS_JOKES) };
    }

    // 1. Opening & sidekick
    addBlock(pick(rng, OPENINGS));
    addBlock(pick(rng, SIDEKICK_INTROS));

    // 2. Conditions + temperature
    addBlock(pick(rng, CONDITIONS[wx.cat] || CONDITIONS.cloudy));
    add('H', `As for the temperature: ${pick(rng, TEMP_QUIPS[wx.band])}`);

    // 3. Something absurd happens (about half the time)
    if (gag) addBlock(gag);

    // 4. The guest
    add('N', pick(rng, g.enter), 'enter');
    add('H', pick(rng, g.intro));
    add('G', g.lines[gCat] || g.lines[wx.baseCat] || g.lines.cloudy);
    const [ask, answer] = pick(rng, g.retort).split('|');
    add('H', ask);
    add('G', answer);
    add('N', `[Exit ${guest.short.toUpperCase()}]`, 'exit');

    // 5. The numbers
    addBlock(pick(rng, DETAILS));

    // 6. Tomorrow and the week
    add('H', pick(rng, TOMORROW));
    add('H', pick(rng, WEEK));

    // 7. Genuinely useful advice (the bit people actually need)
    const advice = adviceKeys(wx);
    advice.slice(0, 2).forEach((k) => add('H', pick(rng, ADVICE[k])));

    // 8. Goodnight
    addBlock(pick(rng, CLOSINGS));

    return {
      ep, title, setting, host, side, guest, lines,
      credit: pick(rng, CREDITS_JOKES),
    };
  }

  function adviceKeys(wx) {
    const keys = [];
    if (wx.pop >= 50 || ['rain', 'drizzle', 'thunder'].includes(wx.baseCat)) keys.push('umbrella');
    if (wx.lo <= 0) keys.push('ice');
    if (wx.gustMax >= 35) keys.push('wind');
    if (wx.baseCat === 'fog') keys.push('fog');
    if (wx.hi >= 27) keys.push('heat');
    if (wx.uv >= 5) keys.push('sun');
    if (wx.hi < 10) keys.push('coat');
    if (!keys.length) keys.push('nice');
    return keys;
  }

  /* ---------------- the stage ---------------- */
  const stage = $('#stage');
  const fx = new WeatherFX($('#fxBack'), $('#fxFront'));
  fx.onLightning = () => flash();

  const SLOT_X = REEL ? { H: 290, S: 650, G: 1010 } : { H: 170, S: 640, G: 1100 };
  const OFFSTAGE = 1800;
  const SLOT_Y = 330;

  function buildStage(film, wx) {
    paintSky($('#sky'), wx);
    $('#backdrop').innerHTML = BACKDROPS[film.setting.id]({ city: state.place.name, temp: fmtT(wx.temp) });
    const actors = $('#actors');
    const slot = (role, c, x) => `<g class="slot" id="slot-${role}" style="transform: translate(${x}px, ${SLOT_Y}px)"><g class="bob" style="animation-delay:-${(x % 7) / 3}s">${characterSVG(c.id)}</g></g>`;
    actors.innerHTML = slot('H', film.host, SLOT_X.H) + slot('S', film.side, SLOT_X.S) + slot('G', film.guest, OFFSTAGE) + '<g id="props"></g>';
    actors.querySelectorAll('.eyes').forEach((e, i) => { e.style.animationDelay = `${i * 1.3}s`; });
    fx.configure(wx, film.setting.outdoor);
  }

  function setSlotX(role, x) {
    const el = $(`#slot-${role}`);
    if (el) el.style.transform = `translate(${x}px, ${SLOT_Y}px)`;
  }

  function flash() {
    const f = $('#flash');
    f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }

  function doAction(action) {
    if (!action) return;
    const [verb, arg] = action.split(':');
    const props = $('#props');
    switch (verb) {
      case 'enter': setSlotX('G', SLOT_X.G); $('#slot-G')?.classList.add('walking'); setTimeout(() => $('#slot-G')?.classList.remove('walking'), 1500); break;
      case 'exit': setSlotX('G', OFFSTAGE); break;
      case 'flash': flash(); break;
      case 'shake': stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); break;
      case 'lightsout': stage.classList.add('lightsout'); setTimeout(() => stage.classList.remove('lightsout'), 1800); break;
      case 'hop': { const el = $(`#slot-${arg} .bob`); if (el) { el.classList.remove('hop'); void el.getBoundingClientRect(); el.classList.add('hop'); } break; }
      case 'fish': props.innerHTML = `<g transform="translate(${SLOT_X.H + 260} 0)">${PROPS.fish}</g>`; break;
      case 'sheep': props.innerHTML = PROPS.sheep; break;
    }
  }

  /* ---------------- voices (see voices.js) ---------------- */
  let castMap = {};
  function recast() {
    if (!player.film) return;
    castMap = VoiceBox.cast([player.film.host.id, player.film.side.id, player.film.guest.id]);
    renderVoicePanel();
  }
  VoiceBox.onChange(() => recast());

  /* ---------------- the projector ---------------- */
  const player = { film: null, idx: -1, playing: false, timer: null, token: 0 };

  function charFor(role) {
    const f = player.film;
    return role === 'H' ? f.host : role === 'S' ? f.side : role === 'G' ? f.guest : null;
  }

  function showTitleCard(film, wx) {
    const place = state.place;
    $('#titlecard').innerHTML = `
      <div class="tc-frame">
        <div class="tc-presents">Tonight's Picture</div>
        <div class="tc-show">${escapeXML(SHOW_NAME)}</div>
        <div class="tc-ep">Episode ${film.ep.toLocaleString('en-GB')}</div>
        <div class="tc-title">“${escapeXML(film.title)}”</div>
        <div class="tc-cast">Starring <b>${film.host.name}</b> &amp; <b>${film.side.name}</b><br>with <b>${film.guest.name}</b></div>
        <div class="tc-loc">Filmed on location: ${escapeXML(film.setting.name)} · Weather for ${escapeXML(place.name)}</div>
      </div>`;
    $('#titlecard').classList.add('show');
  }

  function showCredits() {
    const f = player.film;
    $('#titlecard').innerHTML = `
      <div class="tc-frame">
        <div class="tc-show">The End</div>
        <div class="tc-cast">${f.host.name} · ${f.side.name} · ${f.guest.name}</div>
        <div class="tc-loc">${escapeXML(f.credit)}</div>
        <div class="tc-loc">A new film is shown every day. Come back tomorrow.</div>
        <div class="tc-actions"><button class="btn brass" data-act="replay">Watch again</button><button class="btn ghost" data-act="retake">Demand a retake</button></div>
      </div>`;
    $('#titlecard').classList.add('show');
  }

  function setCaption(line) {
    const cap = $('#caption'), below = $('#captionBelow');
    if (!line) { cap.classList.remove('show'); below.innerHTML = ''; return; }
    const c = charFor(line.who);
    cap.classList.toggle('direction', line.who === 'N');
    cap.innerHTML = c ? `<span class="who">${escapeXML(c.short)}</span><span class="txt">${escapeXML(line.text)}</span>`
                      : `<span class="txt">${escapeXML(line.text)}</span>`;
    cap.classList.add('show');
    below.className = 'caption-below' + (line.who === 'N' ? ' direction' : '');
    below.innerHTML = cap.innerHTML;
    if (REEL) { // shrink long lines until they fit their box
      below.style.fontSize = '';
      let size = parseFloat(getComputedStyle(below).fontSize);
      while (below.scrollHeight > below.clientHeight + 2 && size > 18) { size -= 2; below.style.fontSize = size + 'px'; }
    }
  }

  function clearTalking() {
    document.querySelectorAll('#actors .slot').forEach(el => el.classList.remove('talking', 'listening'));
  }

  function updateProgress() {
    if (!player.film) return;
    const total = player.film.lines.length;
    const pct = Math.max(0, Math.min(1, (player.idx + 1) / (total + 1)));
    $('#progress span').style.width = `${pct * 100}%`;
    $('#playBtn').innerHTML = player.playing ? pauseIcon : playIcon;
    $('#playBtn').setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
  }

  function stopTimers() {
    player.token++;
    clearTimeout(player.timer);
    VoiceBox.cancel();
  }

  function playLine(i) {
    stopTimers();
    const tok = player.token;
    const lines = player.film.lines;
    player.idx = i;
    $('#poster').classList.remove('show');
    clearTalking();

    if (i < 0) { // title card
      setCaption(null);
      showTitleCard(player.film, state.wx);
      updateProgress();
      if (player.playing) player.timer = setTimeout(() => tok === player.token && playLine(0), REEL ? 3000 : 5200);
      return;
    }
    if (i >= lines.length) { // credits
      setCaption(null);
      player.playing = false;
      showCredits();
      updateProgress();
      return;
    }
    $('#titlecard').classList.remove('show');
    const line = lines[i];
    doAction(line.action);
    setCaption(line);
    const c = charFor(line.who);
    if (c) {
      document.querySelectorAll('#actors .slot').forEach(el => el.classList.toggle('listening', el.id !== `slot-${line.who}`));
      $(`#slot-${line.who}`)?.classList.add('talking');
    }
    updateProgress();

    if (!player.playing) { // paused on a line: show it, mouth still
      $(`#slot-${line.who}`)?.classList.remove('talking');
      return;
    }

    const next = () => { if (tok !== player.token) return; clearTalking(); player.timer = setTimeout(() => tok === player.token && playLine(i + 1), line.who === 'N' ? 250 : 450); };
    if (REEL && window.__lineStarts) window.__lineStarts[i] = Date.now();
    const fixed = REEL && window.__lineDurations && window.__lineDurations[i];
    const readMs = fixed || (line.who === 'N' ? (REEL ? 1900 : 2400) : Math.max(REEL ? 1700 : 2000, line.text.length * (REEL ? 52 : 58)));

    if (state.voice && c && VoiceBox.supported) {
      // Mouth moves only while words are actually coming out.
      $(`#slot-${line.who}`)?.classList.remove('talking');
      VoiceBox.say(c.id, line.text, {
        castMap, speed: state.speed,
        onSpeaking: (on) => { if (tok === player.token) $(`#slot-${line.who}`)?.classList.toggle('talking', on); },
      }).then(() => { if (tok === player.token) next(); });
    } else {
      player.timer = setTimeout(next, readMs);
    }
  }

  function play() {
    if (!player.film) return;
    player.playing = true;
    if (player.idx >= player.film.lines.length) player.idx = -1;
    playLine(player.idx);
  }
  function pause() {
    player.playing = false;
    stopTimers();
    clearTalking();
    updateProgress();
  }
  function restart() { player.playing = true; resetActors(); playLine(-1); }
  function step(d) {
    const n = Math.max(-1, Math.min(player.film.lines.length, player.idx + d));
    // Keep the guest's position consistent when skipping about
    const lines = player.film.lines;
    const enterAt = lines.findIndex(l => l.action === 'enter');
    const exitAt = lines.findIndex(l => l.action === 'exit');
    setSlotX('G', n >= enterAt && n < exitAt ? SLOT_X.G : OFFSTAGE);
    playLine(n);
  }
  function resetActors() {
    setSlotX('G', OFFSTAGE);
    const props = $('#props'); if (props) props.innerHTML = '';
  }

  const playIcon = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>';

  /* ---------------- the boring but useful bit ---------------- */
  function renderPanel(d, wx) {
    const place = state.place;
    const [label] = describe(wx.code);
    const quipCat = wx.cat === 'clear' && !wx.isDay ? 'night' : wx.cat;
    const rng = mulberry32(hashStr(todayKey() + place.name)());

    $('#now').innerHTML = `
      <div class="now-main">
        <div class="now-place">${escapeXML(place.name)}<small>${escapeXML([place.admin, place.country].filter(Boolean).join(', '))}</small></div>
        <div class="now-row">
          ${icon(wx.code, wx.isDay, 84)}
          <div class="now-temp">${fmtNum(wx.temp)}<span>°${state.unit}</span></div>
        </div>
        <div class="now-label">${label}</div>
        <div class="now-quip">${escapeXML(pick(rng, PANEL_QUIPS[quipCat] || PANEL_QUIPS.cloudy))}</div>
        <div class="now-hilo">High ${fmtT(wx.hi)} · Low ${fmtT(wx.lo)} · Feels like ${fmtT(wx.feels)}</div>
      </div>
      <dl class="now-stats">
        <div><dt>Wind</dt><dd>${wx.wind} mph ${compass(wx.windDeg, true)}<small>gusts ${wx.gust} mph</small></dd></div>
        <div><dt>Chance of rain</dt><dd>${wx.pop}%<small>${wx.rainSum.toFixed(1)} mm expected</small></dd></div>
        <div><dt>Humidity</dt><dd>${wx.hum}%</dd></div>
        <div><dt>UV index</dt><dd>${wx.uv}<small>${wx.uv >= 6 ? 'high — cover up' : wx.uv >= 3 ? 'moderate' : 'low'}</small></dd></div>
        <div><dt>Sunrise</dt><dd>${wx.sunrise}</dd></div>
        <div><dt>Sunset</dt><dd>${wx.sunset}</dd></div>
        <div><dt>Pressure</dt><dd>${wx.pressure} hPa</dd></div>
        <div><dt>Tomorrow</dt><dd>${fmtT(wx.tHi)} / ${fmtT(wx.tLo)}<small>${describe(wx.tCode)[0]}</small></dd></div>
      </dl>`;

    // Hourly — next 24 hours
    const h = d.hourly;
    const nowKey = d.current.time.slice(0, 13);
    let start = h.time.findIndex(t => t.slice(0, 13) >= nowKey);
    if (start < 0) start = 0;
    let hours = '';
    for (let i = start; i < Math.min(h.time.length, start + 24); i++) {
      hours += `<li><span class="h-time">${i === start ? 'Now' : h.time[i].slice(11, 16)}</span>${icon(h.weather_code[i], !!h.is_day[i], 32)}
        <span class="h-temp">${fmtT(h.temperature_2m[i])}</span><span class="h-pop ${h.precipitation_probability[i] >= 50 ? 'wet' : ''}">${h.precipitation_probability[i] ?? 0}%</span></li>`;
    }
    $('#hourly').innerHTML = hours;

    // Week
    const dd = d.daily;
    const lo = Math.min(...dd.temperature_2m_min), hi = Math.max(...dd.temperature_2m_max);
    const span = Math.max(1, hi - lo);
    $('#week').innerHTML = dd.time.map((t, i) => {
      const name = i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      const l = (dd.temperature_2m_min[i] - lo) / span * 100, r = (dd.temperature_2m_max[i] - lo) / span * 100;
      return `<li>
        <span class="w-day">${name}</span>
        ${icon(dd.weather_code[i], true, 32)}
        <span class="w-cond">${describe(dd.weather_code[i])[0]}</span>
        <span class="w-pop ${dd.precipitation_probability_max[i] >= 50 ? 'wet' : ''}">${dd.precipitation_probability_max[i] ?? 0}%</span>
        <span class="w-lo">${fmtT(dd.temperature_2m_min[i])}</span>
        <span class="w-bar"><i style="left:${l}%;right:${100 - r}%"></i></span>
        <span class="w-hi">${fmtT(dd.temperature_2m_max[i])}</span>
      </li>`;
    }).join('');

    // Advice, in plain English
    const plain = {
      umbrella: `Take an umbrella — ${wx.pop}% chance of rain today.`,
      ice: `Frost or ice likely tonight (low of ${fmtT(wx.lo)}). Careful on paths and roads.`,
      wind: `Gusty: up to ${wx.gustMax} mph. Secure the bins and the garden furniture.`,
      fog: 'Fog about — allow extra time and use dipped headlights.',
      heat: `Hot (high ${fmtT(wx.hi)}): drink water, seek shade, check on vulnerable neighbours.`,
      sun: `UV index ${wx.uv}: sun cream and a hat, particularly around midday.`,
      coat: `Chilly (high ${fmtT(wx.hi)}): proper coat recommended.`,
      nice: 'Nothing to worry about. A decent day for being outside.',
    };
    $('#advice').innerHTML = adviceKeys(wx).map(k => `<li>${plain[k]}</li>`).join('');
  }

  function renderCast(film) {
    $('#castlist').innerHTML = [['Presenting', film.host], ['Assisting (badly)', film.side], ['Special guest', film.guest]].map(([role, c]) => `
      <li><svg viewBox="70 40 160 200" class="cast-face" aria-hidden="true">${characterSVG(c.id)}</svg>
        <div><span class="cast-role">${role}</span><b>${c.name}</b><small>${c.title}</small></div></li>`).join('');
  }

  function renderReelChrome(film, wx) {
    const [label] = describe(wx.code);
    $('#reelHead').innerHTML = `
      <div class="rh-show">The Weather, <em>Unfortunately</em></div>
      <div class="rh-ep">“${escapeXML(film.title)}”</div>
      <div class="rh-wx">${icon(wx.code, wx.isDay, 64)}<span class="rh-temp">${fmtT(wx.temp)}</span><span class="rh-label">${label}<small>${escapeXML(state.place.name)}</small></span></div>`;
    $('#reelFoot').innerHTML = `<b>A new episode every day</b>`;
  }

  /* ---------------- putting it all together ---------------- */
  async function load() {
    if (OPT.place) state.place = { ...state.place, name: OPT.place, admin: '', country: '' };
    const place = state.place;
    $('#placeName').textContent = place.name;
    stage.classList.add('loading');
    pause();
    try {
      state.data = await fetchWeather(place);
      state.demo = false;
    } catch (e) {
      console.warn('Weather fetch failed, using a dramatic reconstruction:', e);
      state.data = demoData();
      state.demo = true;
    }
    $('#demoNote').hidden = !state.demo;
    stage.classList.remove('loading');
    rebuild();
  }

  function rebuild(keepPlaying = false) {
    const wx = summarise(state.data);
    state.wx = wx;
    const film = writeFilm(wx, state.place);
    player.film = film;
    player.idx = -1;
    buildStage(film, wx);
    renderPanel(state.data, wx);
    renderCast(film);
    recast();
    if (REEL) {
      renderReelChrome(film, wx);
      // Hooks for the video renderer: read the script, and let pre-recorded
      // voice tracks set how long each line stays on screen.
      window.__film = { lines: film.lines.map(l => ({ who: l.who, text: l.text, char: charFor(l.who)?.id || null, say: l.who === 'N' ? '' : VoiceBox.speakable(l.text) })) };
    }
    $('#epTitle').textContent = `Episode ${film.ep.toLocaleString('en-GB')} · “${film.title}”`;
    $('#epDate').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#titlecard').classList.remove('show');
    setCaption(null);
    updateProgress();
    if (keepPlaying) restart();
    else $('#poster').classList.add('show');
  }

  /* ---------------- controls ---------------- */
  $('#poster').addEventListener('click', () => { primeSpeech(); restart(); });
  $('#playBtn').addEventListener('click', () => { primeSpeech(); player.playing ? pause() : play(); });
  $('#restartBtn').addEventListener('click', () => { primeSpeech(); restart(); });
  $('#prevBtn').addEventListener('click', () => step(-1));
  $('#nextBtn').addEventListener('click', () => step(1));
  $('#titlecard').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'replay') restart();
    if (act === 'retake') { state.take++; rebuild(true); }
  });
  $('#retakeBtn').addEventListener('click', () => { state.take++; primeSpeech(); rebuild(true); });

  function primeSpeech() {
    // iOS needs speech to be started from a tap; an empty utterance unlocks it.
    if (state.voice && VoiceBox.supported && !primeSpeech.done) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(''));
      primeSpeech.done = true;
    }
  }

  function syncToggles() {
    $('#voiceBtn').setAttribute('aria-pressed', state.voice);
    $('#voiceBtn').title = state.voice ? 'Voices on' : 'Voices off';
    $('#ccBtn').setAttribute('aria-pressed', state.cc);
    stage.classList.toggle('no-cc', !state.cc);
    document.querySelectorAll('[data-unit]').forEach(b => b.setAttribute('aria-pressed', b.dataset.unit === state.unit));
  }
  $('#voiceBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = $('#voicePanel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderVoicePanel();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#voicePanel') && !e.target.closest('#voiceBtn')) $('#voicePanel').hidden = true;
  });

  function setVoiceOn(on) {
    state.voice = on; store.set('twu.voice', on); syncToggles();
    primeSpeech();
    if (player.playing) playLine(player.idx);
  }

  function renderVoicePanel() {
    const panel = $('#voicePanel');
    if (!panel || panel.hidden || !player.film) return;
    if (!VoiceBox.supported) {
      panel.innerHTML = '<p class="vp-tip">Sadly your browser has no voice box. Subtitles it is.</p>';
      return;
    }
    const list = VoiceBox.voices;
    const chars = [player.film.host, player.film.side, player.film.guest];
    const o = VoiceBox.overrides();
    panel.innerHTML = `
      <div class="vp-head">
        <b>Voice cast</b>
        <label class="vp-switch"><input type="checkbox" id="vpOn" ${state.voice ? 'checked' : ''}><span>Voices ${state.voice ? 'on' : 'off'}</span></label>
      </div>
      ${chars.map(c => `
        <div class="vp-row">
          <span class="vp-name">${c.short}</span>
          <select data-char="${c.id}" aria-label="Voice for ${c.name}">
            <option value="">Automatic${castMap[c.id] ? ` (${escapeXML(VoiceBox.label(castMap[c.id]))})` : ''}</option>
            ${list.map(v => `<option value="${escapeXML(v.voiceURI)}" ${o[c.id] === v.voiceURI ? 'selected' : ''}>${escapeXML(VoiceBox.label(v))}</option>`).join('')}
          </select>
          <button class="btn icon vp-try" data-try="${c.id}" title="Hear ${c.short}" aria-label="Hear ${c.short}">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>
          </button>
        </div>`).join('')}
      <label class="vp-speed">Speed <input type="range" id="vpSpeed" min="0.8" max="1.3" step="0.05" value="${state.speed}"><output>${Math.round(state.speed * 100)}%</output></label>
      ${list.length === 0 ? '<p class="vp-tip">No English voices found on this device yet.</p>' : ''}
      ${VoiceBox.IOS ? '<p class="vp-tip">On iPhone and iPad, apps often ignore which voice a page picks, so the cast are told apart by pitch and pace. For truly different voices, open this page in <b>Safari</b>.</p>' : ''}
      ${!VoiceBox.hasGoodVoices() ? `<p class="vp-tip">Your browser only has basic voices. For far better ones: on Windows, open this page in <b>Microsoft Edge</b> (its “Natural” British voices are excellent); on iPhone or Mac, download an <b>Enhanced</b> English (UK) voice in Settings › Accessibility › Spoken Content; in Chrome, the “Google UK English” voices are decent.</p>` : '<p class="vp-tip">★ = high-quality voice.</p>'}`;

    $('#vpOn').addEventListener('change', (e) => setVoiceOn(e.target.checked));
    panel.querySelectorAll('select[data-char]').forEach(sel => sel.addEventListener('change', () => {
      VoiceBox.setOverride(sel.dataset.char, sel.value);
      castMap = VoiceBox.cast(chars.map(c => c.id));
      VoiceBox.say(sel.dataset.char, VoiceBox.SAMPLES[sel.dataset.char], { castMap, speed: state.speed });
    }));
    panel.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', () => {
      if (player.playing) pause();
      VoiceBox.cancel();
      VoiceBox.say(b.dataset.try, VoiceBox.SAMPLES[b.dataset.try], { castMap, speed: state.speed });
    }));
    const sp = $('#vpSpeed');
    sp.addEventListener('input', () => { state.speed = +sp.value; sp.nextElementSibling.textContent = `${Math.round(state.speed * 100)}%`; store.set('twu.speed', state.speed); });
  }

  $('#ccBtn').addEventListener('click', () => { state.cc = !state.cc; store.set('twu.cc', state.cc); syncToggles(); });
  document.querySelectorAll('[data-unit]').forEach(b => b.addEventListener('click', () => {
    if (state.unit === b.dataset.unit) return;
    state.unit = b.dataset.unit; store.set('twu.unit', state.unit); syncToggles();
    if (state.data) { const wasPlaying = player.playing; rebuild(false); if (wasPlaying) restart(); }
  }));
  $('#fullBtn').addEventListener('click', () => {
    const el = $('#theatre');
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => setTimeout(() => fx.resize(), 100));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input')) return;
    if (e.key === ' ') { e.preventDefault(); $('#playBtn').click(); }
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  /* ---------------- location search ---------------- */
  const input = $('#search'), results = $('#results');
  let searchTimer, searchSeq = 0;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { results.hidden = true; return; }
    searchTimer = setTimeout(() => search(q), 250);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = results.querySelector('button'); if (first) first.click(); }
    if (e.key === 'Escape') { results.hidden = true; }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) results.hidden = true; });

  async function search(q) {
    const seq = ++searchSeq;
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: 6, language: 'en', format: 'json' })}`);
      const j = await res.json();
      if (seq !== searchSeq) return;
      const list = j.results || [];
      results.innerHTML = list.length
        ? list.map((r, i) => `<li><button type="button" data-i="${i}">${escapeXML(r.name)}<small>${escapeXML([r.admin1, r.country].filter(Boolean).join(', '))}</small></button></li>`).join('')
        : '<li class="empty">Never heard of it. Is it in Wales?</li>';
      results.hidden = false;
      results.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        const r = list[+b.dataset.i];
        choosePlace({ name: r.name, admin: r.admin1, country: r.country, lat: r.latitude, lon: r.longitude });
      }));
    } catch {
      results.innerHTML = '<li class="empty">The map-reading department is out to lunch. Try again shortly.</li>';
      results.hidden = false;
    }
  }

  function choosePlace(p) {
    state.place = p; state.take = 0;
    store.set('twu.place', p);
    input.value = ''; results.hidden = true;
    load();
  }

  $('#locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    $('#locateBtn').classList.add('busy');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      let name = 'Your Whereabouts', admin = '', country = '';
      try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const j = await r.json();
        name = j.city || j.locality || name; admin = j.principalSubdivision || ''; country = j.countryName || '';
      } catch { /* keep the generic name */ }
      $('#locateBtn').classList.remove('busy');
      choosePlace({ name, admin, country, lat, lon });
    }, () => {
      $('#locateBtn').classList.remove('busy');
      alert("We couldn't find you. Either location is switched off, or you are very good at hiding.");
    }, { timeout: 10000, maximumAge: 600000 });
  });

  syncToggles();
  load();
})();
