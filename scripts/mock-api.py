from http.server import BaseHTTPRequestHandler, HTTPServer
import json
class H(BaseHTTPRequestHandler):
    def reply(self, code=200, obj=None, stream=False):
        self.send_response(code); self.send_header('Content-Type', 'text/event-stream' if stream else 'application/json'); self.end_headers()
        if stream: self.wfile.write(b'data: {"log":"boot ok"}\n\ndata: ready\n\n')
        elif obj is not None: self.wfile.write(json.dumps({'status':'success','response':obj}).encode())
    def do_GET(self):
        if self.path == '/v1/me': self.reply(obj={'user': {'email':'tester@venix.local','plan':{'name':'Test'}}, 'applications':[{'id':'app-1','name':'demo','ram':256}]})
        elif self.path == '/v1/apps/status': self.reply(obj=[{'id':'app-1','cpu':2,'running':True}])
        elif self.path.startswith('/v1/instances/stream/'): self.reply(stream=True)
        else: self.reply(404, {'message':'not found'})
    def do_POST(self):
        if self.path == '/v1/apps/create': self.reply(obj={'id':'app-2','name':'new-app'})
        elif self.path.endswith(('/action','/files/upload','/files/extract','/deploy/trigger')): self.reply(obj={'ok':True})
        elif self.path == '/v1/snapshots': self.reply(obj={'id':'snap-1'})
        else: self.reply(404, {'message':'not found'})
    def do_PATCH(self): self.reply(obj={'ok':True})
    def do_DELETE(self): self.reply(obj={'ok':True})
    def log_message(self, *args): pass
HTTPServer(('127.0.0.1', 53989), H).serve_forever()
