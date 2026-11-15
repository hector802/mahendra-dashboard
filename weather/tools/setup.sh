#!/usr/bin/env bash
# One-off setup for rendering voiced Reels: Kokoro TTS (free, open-source,
# runs locally) and its British voice model (~120 MB, cached in tools/.cache).
set -euo pipefail
cd "$(dirname "$0")"
pip install -q kokoro-onnx soundfile numpy scipy
mkdir -p .cache
base=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
[ -s .cache/kokoro.onnx ] || curl -sSL -o .cache/kokoro.onnx "$base/kokoro-v1.0.int8.onnx"
[ -s .cache/voices-v1.0.bin ] || curl -sSL -o .cache/voices-v1.0.bin "$base/voices-v1.0.bin"
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
node -e "require('playwright')" 2>/dev/null || { echo "playwright (with Chromium) is required" >&2; exit 1; }
echo "Setup OK"
