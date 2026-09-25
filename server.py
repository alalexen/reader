#!/usr/bin/env python3
"""
Local development server for Hebrew Reader.

It serves the static app and proxies Reverso Context example requests. The
proxy keeps Reverso's cross-origin restrictions away from browser JavaScript.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
import html
import json
import re

HOST = "127.0.0.1"
PORT = 8000
REVERSO_ENDPOINT = "https://context.reverso.net/bst-query-service"


def html_to_text(value):
    """Converts simple Reverso highlight markup to plain text."""
    value = value or ""
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value).strip()


class HebrewReaderHandler(SimpleHTTPRequestHandler):
    """Serves project files and same-origin API helpers."""

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/reverso":
            self.handle_reverso(parsed)
            return

        super().do_GET()

    def handle_reverso(self, parsed):
        params = parse_qs(parsed.query)
        word = (params.get("word") or [""])[0].strip()

        try:
            limit = max(1, min(int((params.get("limit") or ["6"])[0]), 10))
        except ValueError:
            limit = 6

        if not word:
            self.send_json({"error": "Missing word parameter."}, status=400)
            return

        payload = json.dumps(
            {
                "source_text": word,
                "target_text": "",
                "source_lang": "he",
                "target_lang": "en",
                "npage": 1,
                "mode": 0,
            }
        ).encode("utf-8")

        request = Request(
            REVERSO_ENDPOINT,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json; charset=UTF-8",
                "Accept": "application/json",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 Chrome/138 Safari/537.36"
                ),
                "Origin": "https://context.reverso.net",
                "Referer": "https://context.reverso.net/",
            },
        )

        try:
            with urlopen(request, timeout=12) as response:
                data = json.loads(response.read().decode("utf-8"))

            rows = data.get("list") if isinstance(data, dict) else []
            rows = rows if isinstance(rows, list) else []

            examples = []
            for row in rows:
                source = html_to_text(row.get("s_text"))
                target = html_to_text(row.get("t_text"))

                if source and target:
                    examples.append({"source": source, "target": target})

                if len(examples) >= limit:
                    break

            self.send_json({"examples": examples})
        except HTTPError as error:
            self.send_json(
                {
                    "error": "Reverso returned an HTTP error.",
                    "status": error.code,
                },
                status=502,
            )
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            self.send_json(
                {
                    "error": "Could not load Reverso examples.",
                    "detail": str(error),
                },
                status=502,
            )

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), HebrewReaderHandler)
    print(f"Hebrew Reader is running at http://{HOST}:{PORT}")
    print("Press Control + C to stop.")
    server.serve_forever()
