# /// script
# dependencies = ["shapely", "numpy"]
# ///
"""Serve the repo for tools/editor.html, let it save data/garden.json and carve chemins.

Run: uv run tools/serve.py   then open http://localhost:8000/tools/editor.html
(python3 tools/serve.py works too, without the chemin tool, which needs shapely.)
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
        """/carve: {garden, branches, width, id} → {garden, report}, or 400 {error}."""
        if self.path != "/carve":
            return self.send_error(404)
        try:
            from chemin import carve
        except ImportError:
            return self.reply(501, {"error": "The chemin tool needs shapely: start the server with uv run tools/serve.py"})
        try:
            req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            garden, report = carve(req["garden"], req["branches"], float(req["width"]), req["id"])
        except (ValueError, KeyError, TypeError) as e:
            return self.reply(400, {"error": str(e)})
        except Exception as e:                                   # a geometry error: keep the server up
            return self.reply(500, {"error": f"Carving failed ({e}): try a slightly different line."})
        self.reply(200, {"garden": garden, "report": report})

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
