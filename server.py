#!/usr/bin/env python3
"""Start the local Hebrew Reader development server."""

from http.server import ThreadingHTTPServer

from backend.http_handler import HebrewReaderHandler

HOST = "127.0.0.1"
PORT = 8000


def main():
    server = ThreadingHTTPServer((HOST, PORT), HebrewReaderHandler)
    print(f"Hebrew Reader is running at http://{HOST}:{PORT}")
    print(
        "Google WaveNet, Vision OCR, and Translation use "
        "Application Default Credentials when available."
    )
    print("HebPipe provides local Hebrew morphological analysis.")
    print("Press Control + C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
