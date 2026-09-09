#!/usr/bin/env python3
"""ローカル確認用サーバー。ブラウザにキャッシュさせず、毎回ファイルを取り直させる。

使い方（プロジェクトのフォルダで）:
    /usr/bin/python3 dev/server.py
同じ Wi-Fi の iPhone からは http://<MacのIP>:8765/ で開ける。
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write('%s - %s\n' % (self.address_string(), fmt % args))
        sys.stdout.flush()


if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', PORT), NoCacheHandler)
    print(f'serving {ROOT} on http://0.0.0.0:{PORT}/ (no-cache)')
    server.serve_forever()
