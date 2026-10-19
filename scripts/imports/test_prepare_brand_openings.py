import datetime as dt
import unittest
from prepare_brand_openings import parse_opening_date


class OpeningDatesTest(unittest.TestCase):
    def test_agreed_conversions_and_uk_day_first(self):
        for text, expected, precision in [
            ('08/07/26', '2026-07-08', 'day'),
            ('24/9/26', '2026-09-24', 'day'),
            ('29/02/2024', '2024-02-29', 'day'),
            ('June 2026', '2026-06-01', 'month'),
            ('Q3 2026', '2026-08-15', 'quarter'),
            ('Q4 2026', '2026-11-15', 'quarter'),
            ('Spring 2026', '2026-04-15', 'season'),
            ('Autumn 2026', '2026-10-15', 'season'),
            ('Winter 2026', '2027-01-15', 'season'),
        ]:
            with self.subTest(text=text):
                self.assertEqual(parse_opening_date(text), (dt.date.fromisoformat(expected), precision))

    def test_does_not_guess_invalid_or_unsupported_dates(self):
        for text in ('31/06/26', '29/02/2026', 'Q5 2026', '2026', '', 'Soon', 'Spring 26'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_opening_date(text)


if __name__ == '__main__':
    unittest.main()
