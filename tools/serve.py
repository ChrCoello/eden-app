# /// script
# dependencies = ["shapely"]
# ///
"""Serve the repo for tools/editor.html, let it save data/garden.json, carve chemins, split and merge zones.

Run: uv run tools/serve.py   then open http://localhost:8000/tools/editor.html
(python3 tools/serve.py works too, without the chemin/split/merge tools, which need shapely.)
"""
import http.server
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WRITABLE = {"/data/garden.json"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_PUT(self):
        if self.path not in WRITABLE:
            return self.send_error(403)
        body = self.rfile.read(int(self.headers["Content-Length"]))
        try:
            json.loads(body)
        except ValueError:
            return self.send_error(400, "not JSON")
        (ROOT / self.path.lstrip("/")).write_bytes(body)
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        """Geometry edits, each {garden, ...} → {garden, report, ...}, or 400/500 {error}:
        /carve {branches, width, id}, /split {id, branches} (+ pieces), /merge {keep, other}."""
        try:
            from chemin import carve
            from zones import merge, split
        except ImportError:
            return self.reply(501, {"error": "This tool needs shapely: start the server with uv run tools/serve.py"})
        routes = {
            "/carve": lambda r: dict(zip(["garden", "report"], carve(r["garden"], r["branches"], float(r["width"]), r["id"]))),
            "/split": lambda r: dict(zip(["garden", "report", "pieces"], split(r["garden"], r["id"], r["branches"]))),
            "/merge": lambda r: dict(zip(["garden", "report"], merge(r["garden"], r["keep"], r["other"]))),
        }
        if self.path not in routes:
            return self.send_error(404)
        try:
            out = routes[self.path](json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
        except (ValueError, KeyError, TypeError) as e:
            return self.reply(400, {"error": str(e)})
        except Exception as e:                                   # a geometry error: keep the server up
            return self.reply(500, {"error": f"Failed ({e}): try a slightly different line."})
        self.reply(200, out)

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))   # for chemin.py
    print("http://localhost:8000/tools/editor.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
