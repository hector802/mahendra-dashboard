#!/usr/bin/env node
/* Render one voiced, vertical "daily forecast" Reel for a place.

   usage: node render-daily.js --place "London" --weather london.json --out DIR [--tone rude|clean] [--take N]

   Needs: a static server on http://localhost:8765 serving the repo root,
   ffmpeg, Playwright + Chromium, and Kokoro set up by setup.sh.
   Writes DIR/<slug>.mp4, DIR/<slug>-cover.jpg and DIR/<slug>-caption.txt. */

const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const T = __dirname;
const place = args.place, out = path.resolve(args.out), tone = args.tone || 'rude', take = args.take || '0';
const weatherBody = fs.readFileSync(args.weather, 'utf8');
const slug = place.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const work = path.join(out, `.work-${slug}`);
fs.mkdirSync(work, { recursive: true });

const EMOJI = { clear: '☀️', cloudy: '☁️', fog: '🌫️', drizzle: '🌦️', rain: '☔', snow: '❄️', thunder: '⛈️' };
function catOf(code) {
  if (code <= 1) return 'clear'; if (code <= 3) return 'cloudy'; if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle'; if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'; if (code >= 95) return 'thunder'; return 'cloudy';
}

(async () => {
  const url = `http://localhost:8765/weather/?reel&daily&tone=${tone}&take=${take}&place=${encodeURIComponent(place)}`;
  const b = await chromium.launch();
  const prep = async (p) => {
    p.on('pageerror', e => console.error(slug, 'page error:', e.message));
    await p.route('**/api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: weatherBody }));
    await p.addInitScript(() => { try { localStorage.setItem('twu.voice', 'false'); localStorage.setItem('twu.cc', 'true'); localStorage.setItem('twu.unit', '"C"'); } catch {} });
    await p.goto(url);
    await p.waitForFunction(() => window.__film && !document.querySelector('#stage').classList.contains('loading'), null, { timeout: 30000 });
  };

  // 1) Read today's script and record the voices.
  const c0 = await b.newContext({ viewport: { width: 720, height: 1280 } }); const p0 = await c0.newPage(); await prep(p0);
  const film = await p0.evaluate(() => window.__film); await c0.close();
  fs.writeFileSync(path.join(work, 'lines.json'), JSON.stringify(film.lines));
  const durs = JSON.parse(execFileSync('python3', [path.join(T, 'synth.py'), path.join(work, 'lines.json'), path.join(work, 'voice')], { maxBuffer: 1e7 }).toString().trim().split('\n').pop());
  const ms = film.lines.map((l, i) => (durs[i] ? Math.round(durs[i] * 1000 + 250) : 0));

  // 2) Film it, holding each line for exactly its spoken length.
  const recDir = path.join(work, 'rec'); fs.rmSync(recDir, { recursive: true, force: true });
  const ctx = await b.newContext({ viewport: { width: 720, height: 1280 }, recordVideo: { dir: recDir, size: { width: 720, height: 1280 } } });
  const p = await ctx.newPage(); await prep(p);
  await p.evaluate((ms) => { window.__lineDurations = ms; window.__lineStarts = []; }, ms);
  await p.waitForTimeout(1000);
  const tClick = await p.evaluate(() => { const t = Date.now(); document.querySelector('#poster').click(); return t; });
  await p.waitForFunction(() => !!document.querySelector('#titlecard .tc-actions'), null, { timeout: 300000, polling: 200 });
  await p.waitForTimeout(3500);
  const tEnd = Date.now();
  const box = await p.evaluate(() => { const r = document.querySelector('#captionBelow').getBoundingClientRect(); return [Math.round(r.top), Math.round(Math.min(r.height, 1280 - r.top))]; });
  const starts = await p.evaluate(() => window.__lineStarts);
  fs.writeFileSync(path.join(work, 'starts.json'), JSON.stringify({ tClick, starts }));
  const vid = p.video(); await ctx.close(); await b.close();
  const webm = await vid.path();
  const dur = (tEnd - tClick) / 1000;

  // 3) Line the sound up with the picture (measured from subtitle changes).
  const [clickAt, fit] = execFileSync('python3', [path.join(T, 'calibrate.py'), webm, path.join(work, 'starts.json'), String(box[0]), String(box[1])]).toString().trim().split(' ').map(Number);
  const ss = fit < 0.15 ? clickAt : 1.46;
  if (fit >= 0.15) console.error(slug, `warning: sync check inconclusive (fit ${fit}s); used typical offset`);

  // 4) Soundtrack: voices at their line starts over quiet weather ambience.
  const data = JSON.parse(weatherBody);
  const cat = catOf(data.current.weather_code);
  const amb = path.join(work, 'ambience.wav');
  execFileSync('python3', [path.join(T, 'ambience.py'), cat, film.setting, String(dur + 1), amb]);
  const inputs = ['-i', amb], filters = [], labels = [];
  let n = 1;
  film.lines.forEach((l, i) => {
    if (!durs[i] || !starts[i]) return;
    const delay = Math.max(0, starts[i] - tClick + 120);
    inputs.push('-i', path.join(work, 'voice', `line-${i}.wav`));
    filters.push(`[${n}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${delay}|${delay}[v${n}]`); labels.push(`[v${n}]`); n++;
  });
  filters.push('[0:a]volume=0.35[amb]');
  filters.push(`[amb]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`);
  const track = path.join(work, 'track.m4a');
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[aout]', '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', track]);
  const mp4 = path.join(out, `${slug}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(ss), '-i', webm, '-i', track, '-map', '0:v', '-map', '1:a', '-shortest',
    '-vf', 'scale=1080:1920:flags=lanczos', '-r', '30', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '21', '-maxrate', '6M', '-bufsize', '12M',
    '-c:a', 'copy', '-movflags', '+faststart', mp4]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '5', '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(out, `${slug}-cover.jpg`)]);

  // 5) Ready-to-paste Instagram caption.
  const gLine = (film.lines.find(l => l.who === 'G') || {}).text || '';
  const quote = gLine.length > 170 ? gLine.slice(0, gLine.lastIndexOf(' ', 165)) + '…' : gLine;
  const caption = [
    `${place} weather, ${film.date} ${EMOJI[catOf(data.daily.weather_code[0])] || ''}`.trim(),
    `${film.cond}. High ${film.hi}, low ${film.lo}, ${film.pop}% chance of rain.`,
    '',
    quote ? `“${quote}”` : '',
    '',
    `Starring ${film.host} and ${film.side}, with ${film.guest}.`,
    'New forecast every morning. Follow for tomorrow’s, delivered by worse people.',
    '',
    `#britishweather #ukweather #britishhumour #weatherforecast #comedy #sketchcomedy ${film.tags}`.trim(),
  ].join('\n');
  fs.writeFileSync(path.join(out, `${slug}-caption.txt`), caption + '\n');
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`${slug}: ${Math.round(dur)}s, ${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB, ${labels.length} voiced lines, sync fit ${fit}s`);
})().catch(e => { console.error(e); process.exit(1); });
