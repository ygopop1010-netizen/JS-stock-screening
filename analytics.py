"""Daily-bar swing indicators. No execution or investment guarantees."""
import math
import statistics


def analyze(symbol, bars):
    bars = sorted(bars, key=lambda b: b['date'])
    if len(bars) < 61:
        raise ValueError('최소 61개 일봉이 필요합니다.')
    if len({b['date'] for b in bars}) != len(bars):
        raise ValueError('날짜가 중복되었습니다.')
    for b in bars:
        if not all(math.isfinite(b[k]) for k in ('open', 'high', 'low', 'close', 'volume')):
            raise ValueError('유효하지 않은 가격입니다.')
        if b['low'] <= 0 or b['volume'] < 0 or not b['low'] <= min(b['open'], b['close']) <= max(b['open'], b['close']) <= b['high']:
            raise ValueError('OHLC 가격 범위가 잘못되었습니다.')
    closes = [b['close'] for b in bars]
    price = closes[-1]
    ma20, ma60 = statistics.mean(closes[-20:]), statistics.mean(closes[-60:])
    differences = [closes[i] - closes[i-1] for i in range(len(closes)-14, len(closes))]
    gain = statistics.mean(max(d, 0) for d in differences)
    loss = statistics.mean(max(-d, 0) for d in differences)
    rsi = 50 if gain == loss == 0 else (100 if loss == 0 else 100-100/(1+gain/loss))
    tr = [max(bars[i]['high']-bars[i]['low'], abs(bars[i]['high']-closes[i-1]), abs(bars[i]['low']-closes[i-1])) for i in range(len(bars)-14, len(bars))]
    atr = statistics.mean(tr)
    avg_volume = statistics.mean(b['volume'] for b in bars[-21:-1])
    volume_ratio = bars[-1]['volume']/avg_volume if avg_volume else None
    high20 = max(b['high'] for b in bars[-21:-1])
    momentum = (price/closes[-21]-1)*100
    checks = [('20·60일선 위', price > ma20 > ma60, 30), ('20일 수익률 양수', momentum > 0, 20), ('RSI 45~70', 45 <= rsi <= 70, 20), ('거래량 1.2배 이상', volume_ratio is not None and volume_ratio >= 1.2, 15), ('직전 20일 고가 돌파', price > high20, 15)]
    score = sum(weight for _, passed, weight in checks if passed)
    stop = max(0, price-2*atr)
    return dict(symbol=symbol, date=bars[-1]['date'], price=price, ma20=ma20, ma60=ma60, ma120=statistics.mean(closes[-120:]) if len(closes)>=120 else None, rsi=rsi, atr=atr, volume_ratio=volume_ratio, turnover20=statistics.mean(b['close']*b['volume'] for b in bars[-20:]), support20=min(b['low'] for b in bars[-20:]), resistance20=high20, history=[{'date':b['date'],'close':b['close']} for b in bars[-81:]], momentum=momentum, score=score, signal='타점 검토' if score >= 70 else '관찰' if score >= 40 else '대기', stop=stop, target=price+4*atr, risk_per_share=price-stop, reasons=[label for label, passed, _ in checks if passed], missing=[label for label, passed, _ in checks if not passed])
