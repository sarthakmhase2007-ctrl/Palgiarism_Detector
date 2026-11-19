"""Run the Vercel-style website locally: python dev_server.py"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
from api.analyze import handler as ApiHandler

os.chdir(Path(__file__).resolve().parent)

class LocalHandler(ApiHandler, SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/analyze'):
            return ApiHandler.do_GET(self)
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/api/analyze':
            return self.send_json(404, {'error': 'Not found.'})
        return ApiHandler.do_POST(self)

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8000), LocalHandler)
    print('Open http://127.0.0.1:8000')
    server.serve_forever()
