import unittest
from macro import interpret


class MacroTests(unittest.TestCase):
    def test_cpi_matches_calendar_year(self):
        result=interpret('CPIAUCSL',[('2025-01-01',100),('2025-02-01',120),('2026-01-01',103)])
        self.assertAlmostEqual(result['value'],3)

    def test_missing_prior_year(self):
        with self.assertRaises(ValueError):interpret('CPIAUCSL',[('2026-01-01',103)])

    def test_gdp_and_inversion(self):
        self.assertAlmostEqual(interpret('GDPC1',[('2025-10-01',100),('2026-01-01',101)])['value'],4.060401)
        self.assertEqual(interpret('T10Y2Y',[('2026-01-01',-.5)])['signal'],'장단기 금리 역전')
