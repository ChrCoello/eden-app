"""Serve the repo for tools/editor.html and let it save data/garden.json.

Run: python3 tools/serve.py   then open http://localhost:8000/tools/editor.html
"""
import http.server
import json
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


if __name__ == "__main__":
    print("http://localhost:8000/tools/editor.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
