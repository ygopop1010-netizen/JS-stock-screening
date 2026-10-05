import json
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
from server import Handler
from test_analytics import bars


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.base=f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()

    def test_page_and_import(self):
        with urllib.request.urlopen(self.base+'/') as response:
            self.assertIn('총서 기반'.encode(),response.read())
        data='date,open,high,low,close,volume\n'+'\n'.join(','.join(str(b[k]) for k in ('date','open','high','low','close','volume')) for b in bars())
        request=urllib.request.Request(self.base+'/api/import',data=json.dumps({'symbol':'^KS11','csv':data}).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(request) as response:
            result=json.load(response)
        self.assertEqual(result['kind'],'market')
        self.assertEqual(result['price'],180)
        self.assertEqual(result['source'],'사용자 CSV')
        self.assertEqual(len(result['history']),80)

    def test_reject_missing_columns(self):
        request=urllib.request.Request(self.base+'/api/import',data=json.dumps({'symbol':'TEST','csv':'date,close\n2026-01-01,100'}).encode(),headers={'Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(request)
        self.assertEqual(caught.exception.code,400)
