# Synthesised weather ambience (original, no samples). usage: ambience.py cat setting seconds out.wav
import sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
cat, setting, secs, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
sr = 44100; n = int(sr * secs); t = np.arange(n) / sr
rng = np.random.default_rng(7)
def noise(): return rng.standard_normal(n)
def lp(x, f): return sosfilt(butter(4, f, 'low', fs=sr, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=sr, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=sr, output='sos'), x)
mix = np.zeros(n)
indoor = setting in ('studio', 'ministry', 'parlour')
if cat in ('rain', 'thunder'):
    r = bp(noise(), 400, 9000) * (0.9 + 0.1 * np.sin(2 * np.pi * 0.13 * t))
    drops = (rng.random(n) > 0.9993) * rng.random(n); r += hp(drops, 2000) * 3
    mix += (lp(r, 1500) if indoor else r) * 0.18
if cat == 'drizzle':
    mix += bp(noise(), 2000, 10000) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t)) * 0.06
if cat == 'thunder':
    for start in np.arange(4, secs - 4, 9.5):
        i = int(start * sr); L = int(4 * sr); env = np.exp(-np.linspace(0, 5, L)) * (1 - np.exp(-np.linspace(0, 60, L)))
        seg = lp(rng.standard_normal(L), 160) * env * 2.6
        mix[i:i + L] += seg[:max(0, min(L, n - i))]
if cat in ('snow', 'fog', 'clear') or setting in ('castle', 'field'):
    w = lp(noise(), 500) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t + 1) ** 2)
    mix += w * (0.10 if cat == 'snow' else 0.04)
if setting == 'pier':
    swell = (0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 7.5)) ** 3)
    mix += lp(noise(), 900) * swell * 0.16
    for s0 in np.arange(5, secs, 13):  # gull
        i = int(s0 * sr); L = int(0.35 * sr); tt = np.arange(L) / sr
        f = 1400 + 500 * np.sin(2 * np.pi * 3 * tt)
        call = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.hanning(L) * 0.05
        mix[i:i + L] += call[:max(0, min(L, n - i))]
if cat == 'clear':
    for s0 in np.arange(2, secs, 3.3):  # birdsong chirps
        for k in range(rng.integers(2, 5)):
            i = int((s0 + k * 0.14) * sr); L = int(0.09 * sr); tt = np.arange(L) / sr
            f = 3200 + 1800 * tt / tt[-1] * (1 if k % 2 else -1) + 600
            c = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.hanning(L) * 0.035
            mix[i:i + L] += c[:max(0, min(L, n - i))]
if cat == 'fog':
    for s0 in np.arange(6, secs, 14):  # distant foghorn
        i = int(s0 * sr); L = int(2.2 * sr); tt = np.arange(L) / sr
        horn = sum(np.sin(2 * np.pi * 98 * h * tt) / h for h in (1, 2, 3)) * np.minimum(1, np.minimum(tt * 4, (2.2 - tt) * 2))
        mix[i:i + L] += lp(horn, 600)[:max(0, min(L, n - i))] * 0.05
if indoor:
    mix += lp(noise(), 300) * 0.015
fade = np.minimum(1, np.minimum(t / 1.5, (secs - t) / 2))
mix = np.clip(mix * fade, -1, 1)
wavfile.write(out, sr, (np.stack([mix, np.roll(mix, 300)], 1) * 32767 * 0.9).astype(np.int16))
