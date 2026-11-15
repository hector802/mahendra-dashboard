# usage: calibrate.py video.webm starts.json [y height]  -> prints video-time of the click (seconds)
import sys, json, subprocess, numpy as np
d = json.load(open(sys.argv[2])); t0 = d['tClick']
exp = [(s - t0) / 1000 for s in d['starts'] if s]
W, H, FPS = 72, 30, 25
CY = int(sys.argv[3]) if len(sys.argv) > 3 else 833
CH = int(sys.argv[4]) if len(sys.argv) > 4 else 200
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-vf', f'crop=720:{CH}:0:{CY},scale={W}:{H},format=gray,fps={FPS}', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(int)
diff = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
seen = [(k + 1) / FPS for k in range(len(diff)) if diff[k] > 6 and (k == 0 or diff[k - 1] <= 6)]
# try every plausible offset; choose the one that best aligns expected starts with seen changes
best = None
for off in np.arange(0, 15, 0.02):
    err = sorted(min(abs(e + off - s) for s in seen) for e in exp)
    score = np.mean(err[: max(3, int(len(err) * 0.7))])
    if best is None or score < best[0]: best = (score, off)
print(round(best[1], 3), round(best[0], 3))
