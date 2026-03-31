#!/usr/bin/env python3
"""Kid Browser Monitor — Collection Server.

Receives Chrome history entries from browser extensions and stores them in SQLite.
Runs on Thelio behind a Cloudflare Tunnel.
"""

import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.getenv("KBM_PORT", "9847"))
API_KEY = os.getenv("KBM_API_KEY", "")
DB_PATH = os.getenv("KBM_DB_PATH", "")

if not API_KEY:
    raise RuntimeError("KBM_API_KEY environment variable is required")
if not DB_PATH:
    raise RuntimeError("KBM_DB_PATH environment variable is required")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kid TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT,
            visit_time INTEGER NOT NULL,
            received_at TEXT NOT NULL,
            UNIQUE(kid, url, visit_time)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_kid_visit ON history(kid, visit_time)
    """)
    conn.commit()
    conn.close()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{ts}] {args[0]}")

    def do_POST(self):
        if self.path != "/api/history":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        if length == 0 or length > 5 * 1024 * 1024:
            self.send_error(400, "Bad content length")
            return

        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(400, "Invalid JSON")
            return

        if body.get("apiKey") != API_KEY:
            self.send_error(401, "Unauthorized")
            return

        kid = body.get("kid", "").strip()
        entries = body.get("entries", [])
        if not kid or not isinstance(entries, list):
            self.send_error(400, "Missing kid or entries")
            return

        now = datetime.now(timezone.utc).isoformat()
        conn = sqlite3.connect(DB_PATH)
        inserted = 0
        for e in entries:
            url = e.get("url", "")
            title = e.get("title", "")
            visit_time = e.get("lastVisitTime", 0)
            if not url or not visit_time:
                continue
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO history (kid, url, title, visit_time, received_at) VALUES (?, ?, ?, ?, ?)",
                    (kid, url, title, int(visit_time), now),
                )
                inserted += 1
            except sqlite3.Error:
                pass
        conn.commit()
        conn.close()

        resp = json.dumps({"ok": True, "inserted": inserted}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)

    def do_GET(self):
        if self.path == "/health":
            resp = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return
        self.send_error(404)


if __name__ == "__main__":
    init_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Kid Browser Monitor listening on port {PORT}")
    print(f"Database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()
