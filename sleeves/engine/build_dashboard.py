"""Render results/dashboard.json into a single self-contained dashboard/index.html."""
import json
from .config import ROOT, RESULTS_DIR


def build() -> str:
    data = json.loads((RESULTS_DIR / "dashboard.json").read_text())
    tpl = (ROOT / "dashboard" / "template.html").read_text()
    blob = json.dumps(data, separators=(",", ":"), default=float).replace("</", "<\\/")
    html = tpl.replace("__DATA__", blob)
    out = ROOT / "dashboard" / "index.html"
    out.write_text(html)
    print(f"wrote {out} ({len(html)/1024:.0f} KB)")
    return str(out)


if __name__ == "__main__":
    build()
