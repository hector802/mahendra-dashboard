# usage: synth.py lines.json outdir  -> writes outdir/line-<i>.wav and prints durations JSON
import sys, json, os, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
D = os.path.dirname(os.path.abspath(__file__))
M = os.environ.get("TWU_TTS_DIR", os.path.join(D, ".cache"))
k = Kokoro(os.path.join(M, "kokoro.onnx"), os.path.join(M, "voices-v1.0.bin"))
st = k.get_voice_style
CAST = {
  'drench':    (st('bm_george'), 0.95),
  'arabella':  (st('bf_emma'), 1.0),
  'wilf':      (st('bm_lewis') * 0.55 + st('bm_daniel') * 0.45, 1.05),
  'captain':   (st('bm_fable'), 1.12),
  'nimbus':    (st('bm_daniel'), 1.08),
  'edna':      (st('bf_isabella'), 1.05),
  'smethwick': (st('bm_lewis'), 0.84),
}
lines = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
durs = {}
for i, l in enumerate(lines):
    if not l.get('char') or not l.get('say'): continue
    style, speed = CAST[l['char']]
    audio, sr = k.create(l['say'], voice=style, speed=speed, lang='en-gb')
    # trim leading/trailing near-silence
    nz = np.where(np.abs(audio) > 0.01)[0]
    if len(nz): audio = audio[max(0, nz[0] - 600): nz[-1] + 1200]
    sf.write(f"{out}/line-{i}.wav", audio, sr)
    durs[i] = round(len(audio) / sr, 3)
print(json.dumps(durs))
