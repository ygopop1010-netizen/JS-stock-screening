import unittest
from analytics import analyze
from datetime import date, timedelta


def bars():
    return [dict(date=(date(2026,1,1)+timedelta(days=i)).isoformat(), open=100+i, high=102+i, low=99+i, close=101+i, volume=1000) for i in range(80)]


class AnalyticsTests(unittest.TestCase):
    def test_uptrend_and_risk(self):
        value=analyze('TEST',bars())
        self.assertGreater(value['price'],value['ma20'])
        self.assertGreater(value['ma20'],value['ma60'])
        self.assertEqual(value['rsi'],100)
        self.assertAlmostEqual(value['target']-value['price'],2*(value['price']-value['stop']))
        self.assertIn('RSI 45~70',value['missing'])

    def test_flat_and_zero_volume(self):
        data=bars()
        for b in data:b.update(open=100,high=100,low=100,close=100,volume=0)
        value=analyze('FLAT',data)
        self.assertEqual(value['rsi'],50)
        self.assertIsNone(value['volume_ratio'])
        self.assertEqual(value['risk_per_share'],0)

    def test_bad_input(self):
        with self.assertRaises(ValueError):analyze('SHORT',bars()[:60])
        data=bars();data[-1]['close']=float('nan')
        with self.assertRaises(ValueError):analyze('BAD',data)
        data=bars();data[-1]['date']=data[0]['date']
        with self.assertRaises(ValueError):analyze('DUP',data)


if __name__=='__main__':unittest.main()
