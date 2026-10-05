"""Public FRED observations. Observation dates are not release timestamps."""
import csv
import io
import math
import urllib.request
from datetime import date, timedelta

SERIES = {'CPIAUCSL':('미국 CPI 전년동월', 'yoy'), 'UNRATE':('미국 실업률', 'level'), 'FEDFUNDS':('미국 유효 연방기금금리', 'level'), 'T10Y2Y':('미국 10년−2년 금리차', 'spread'), 'GDPC1':('미국 실질 GDP 분기 성장', 'gdp')}


def interpret(series, rows):
    if not rows:
        raise ValueError('사용 가능한 관측값이 없습니다.')
    name, mode=SERIES[series]
    current_date,current=rows[-1]
    if mode=='yoy':
        previous=dict(rows).get(f'{int(current_date[:4])-1}{current_date[4:]}')
        if previous is None or previous<=0:
            raise ValueError('전년동월 관측값이 필요합니다.')
        value=(current/previous-1)*100
        signal='물가 압력 관찰 · 예상치·전월 추세 별도 확인'
    elif mode=='gdp':
        if len(rows)<2 or rows[-2][1]<=0:
            raise ValueError('직전 분기 관측값이 필요합니다.')
        value=((current/rows[-2][1])**4-1)*100
        signal='경기 확장 관측' if value>0 else '경기 위축 관측'
    else:
        value=current
        if mode=='spread':
            signal='장단기 금리 역전' if value<0 else '장단기 금리차 양수'
        elif len(rows)>=2:
            signal='직전 관측 대비 상승' if value>rows[-2][1] else '직전 관측 대비 하락' if value<rows[-2][1] else '직전 관측과 동일'
        else:
            signal='비교 자료 없음'
    return dict(series=series,name=name,date=current_date,value=value,unit='%p' if mode=='spread' else '%',signal=signal,source='FRED 공개 관측값',url=f'https://fred.stlouisfed.org/series/{series}')


def fetch_macro(series):
    try:
        start=(date.today()-timedelta(days=800)).isoformat()
        request=urllib.request.Request(f'https://fred.stlouisfed.org/graph/?id={series}&cosd={start}&coed={date.today().isoformat()}&mode=fred&type=csv',headers={'User-Agent':'SwingRadar/1.0'})
        with urllib.request.urlopen(request,timeout=12) as response:
            raw=response.read(2_000_000).decode('utf-8-sig')
        reader=csv.reader(io.StringIO(raw));next(reader)
        rows=[]
        for row in reader:
            if len(row)!=2 or row[1] in ('.',''):
                continue
            stamp=date.fromisoformat(row[0]).isoformat()
            value=float(row[1])
            if math.isfinite(value):rows.append((stamp,value))
        return interpret(series,sorted(rows))
    except Exception as exc:
        return dict(series=series,name=SERIES[series][0],error=f'{type(exc).__name__}: {exc}')
