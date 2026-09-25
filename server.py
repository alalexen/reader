#!/usr/bin/env python3
"""Local static development server for Hebrew Reader."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8000


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), SimpleHTTPRequestHandler)
    print(f"Hebrew Reader is running at http://{HOST}:{PORT}")
    print("Press Control + C to stop.")
    server.serve_forever()
