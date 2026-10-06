import csv
import io
import json
import math
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse
from analytics import analyze
from macro import SERIES, fetch_macro

ROOT = Path(__file__).parent
SYMBOLS = {'005930.KS':'삼성전자', '000660.KS':'SK하이닉스', '035420.KS':'NAVER', '005380.KS':'현대차', '068270.KS':'셀트리온', 'AAPL':'Apple', 'MSFT':'Microsoft', 'NVDA':'NVIDIA', 'AMZN':'Amazon', 'GOOGL':'Alphabet', 'META':'Meta', 'TSLA':'Tesla'}
MARKETS = {'^KS11':'한국 KOSPI', '^KQ11':'한국 KOSDAQ', '^GSPC':'미국 S&P 500', '^IXIC':'미국 NASDAQ', '^N225':'일본 Nikkei', '^HSI':'홍콩 Hang Seng', '000001.SS':'중국 Shanghai', '^GDAXI':'독일 DAX', '^FTSE':'영국 FTSE', '^VIX':'변동성 VIX', '^TNX':'미국 10년 금리 지수', 'KRW=X':'달러/원', 'CL=F':'WTI 원유', 'GC=F':'금 선물'}
CACHE = {}


def fetch(symbol):
    if symbol in CACHE and time.time()-CACHE[symbol][0] < 900:
        return CACHE[symbol][1]
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol, safe="")}?range=1y&interval=1d'
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=12) as response:
        result = json.load(response)['chart']['result'][0]
    q = result['indicators']['quote'][0]
    bars = []
    dropped = 0
    for i, stamp in enumerate(result['timestamp']):
        if any(q[k][i] is None for k in ('open','high','low','close','volume')):
            continue
        bar=dict(date=datetime.fromtimestamp(stamp, timezone.utc).date().isoformat(), **{k:float(q[k][i]) for k in ('open','high','low','close','volume')})
        if not all(math.isfinite(bar[k]) for k in ('open','high','low','close','volume')) or bar['volume']<0 or bar['low']<=0 or not bar['low']<=min(bar['open'],bar['close'])<=max(bar['open'],bar['close'])<=bar['high']:
            dropped += 1
            continue
        bars.append(bar)
    value = analyze(symbol, bars)
    value.update(currency=result['meta'].get('currency'), source='Yahoo Finance 일봉', adjusted=False, dropped_bars=dropped)
    CACHE[symbol] = (time.time(), value)
    return value


def collect(item):
    symbol, name = item
    try:
        return dict(fetch(symbol), name=name)
    except Exception as exc:
        return dict(symbol=symbol, name=name, error=f'{type(exc).__name__}: {exc}')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT/'static'), **kwargs)

    def send_json(self, value, status=200):
        data = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/health':
            self.send_json({'ok':True})
        elif path == '/api/dashboard':
            with ThreadPoolExecutor(max_workers=8) as pool:
                stocks = list(pool.map(collect, SYMBOLS.items()))
                markets = list(pool.map(collect, MARKETS.items()))
            self.send_json(dict(stocks=stocks, markets=markets, fetched_at=datetime.now(timezone.utc).isoformat()))
        elif path == '/api/macro':
            with ThreadPoolExecutor(max_workers=5) as pool:
                observations=list(pool.map(fetch_macro,SERIES))
            self.send_json({'observations':observations})
        else:
            super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != '/api/import':
            return self.send_json({'error':'Unknown endpoint'}, 404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 2_000_000:
                raise ValueError('CSV 크기는 2MB 이하여야 합니다.')
            payload = json.loads(self.rfile.read(length))
            symbol = payload.get('symbol', '').strip().upper()
            if not re.fullmatch(r'[A-Z0-9.^=_-]{1,30}', symbol):
                raise ValueError('종목 코드를 확인하세요.')
            rows = list(csv.DictReader(io.StringIO(payload['csv'].lstrip('\ufeff'))))
            bars = []
            for row in rows:
                date = datetime.strptime(row['date'], '%Y-%m-%d').date().isoformat()
                bars.append(dict(date=date, **{k:float(row[k]) for k in ('open','high','low','close','volume')}))
            result = analyze(symbol, bars)
            result.update(name=MARKETS.get(symbol, SYMBOLS.get(symbol,symbol)), kind='market' if symbol in MARKETS else 'stock', source='사용자 CSV', adjusted='사용자 확인 필요')
            self.send_json(result)
        except (ValueError, KeyError, TypeError) as exc:
            self.send_json({'error':str(exc)}, 400)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8000'))
    print(f'JSWING JSCREENING listening on port {port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
