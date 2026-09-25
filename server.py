#!/usr/bin/env python3
"""
Local development server for Hebrew Reader.

It serves the static app and proxies Reverso Context example requests. Reverso
does not reliably allow direct browser requests, so the proxy fetches the
public Context page and extracts example pairs server-side.
"""

from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen
import html
import json

HOST = "127.0.0.1"
PORT = 8000
REVERSO_CONTEXT_BASE = (
    "https://context.reverso.net/translation/hebrew-english/"
)


class ReversoExamplesParser(HTMLParser):
    """Extracts Hebrew-English example pairs from nested Reverso markup."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.examples = []
        self.example_depth = 0
        self.source_depth = 0
        self.target_depth = 0
        self.source_parts = []
        self.target_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = set(attributes.get("class", "").split())

        # A Reverso result is wrapped in a div with class "example".
        if tag == "div" and "example" in classes and self.example_depth == 0:
            self.example_depth = 1
            self.source_parts = []
            self.target_parts = []
            return

        if self.example_depth == 0:
            return

        # Track every nested div so an inner closing tag cannot end the whole
        # example prematurely.
        if tag == "div":
            self.example_depth += 1

        if tag == "div" and "src" in classes and self.source_depth == 0:
            self.source_depth = self.example_depth
        elif tag == "div" and "trg" in classes and self.target_depth == 0:
            self.target_depth = self.example_depth

    def handle_endtag(self, tag):
        if tag != "div" or self.example_depth == 0:
            return

        closing_depth = self.example_depth

        if self.source_depth == closing_depth:
            self.source_depth = 0

        if self.target_depth == closing_depth:
            self.target_depth = 0

        self.example_depth -= 1

        if self.example_depth != 0:
            return

        source = " ".join(" ".join(self.source_parts).split()).strip()
        target = " ".join(" ".join(self.target_parts).split()).strip()

        if source and target:
            self.examples.append(
                {
                    "source": html.unescape(source),
                    "target": html.unescape(target),
                }
            )

        self.source_parts = []
        self.target_parts = []

    def handle_data(self, data):
        if self.source_depth:
            self.source_parts.append(data)
        elif self.target_depth:
            self.target_parts.append(data)


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

        url = REVERSO_CONTEXT_BASE + quote(word, safe="")

        request = Request(
            url,
            method="GET",
            headers={
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 Chrome/138 Safari/537.36"
                ),
            },
        )

        try:
            with urlopen(request, timeout=12) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                page = response.read().decode(charset, errors="replace")

            parser = ReversoExamplesParser()
            parser.feed(page)

            self.send_json({"examples": parser.examples[:limit]})
        except HTTPError as error:
            self.send_json(
                {
                    "error": "Reverso returned an HTTP error.",
                    "status": error.code,
                },
                status=502,
            )
        except (URLError, TimeoutError, UnicodeError) as error:
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
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), HebrewReaderHandler)
    print(f"Hebrew Reader is running at http://{HOST}:{PORT}")
    print("Reverso examples proxy is enabled at /api/reverso")
    print("Press Control + C to stop.")
    server.serve_forever()
