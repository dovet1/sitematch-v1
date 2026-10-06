import { parseIxbrlFigures, parseIxNumber } from '../accounts'

// A trimmed filing: current and prior year, one dimensional (reserves column) equity fact.
const filing = `
<html><body>
<ix:header><ix:resources>
  <xbrli:context id="cur"><xbrli:entity><xbrli:identifier>01</xbrli:identifier></xbrli:entity>
    <xbrli:period><xbrli:startDate>2024-04-01</xbrli:startDate><xbrli:endDate>2025-03-31</xbrli:endDate></xbrli:period></xbrli:context>
  <xbrli:context id="prev"><xbrli:entity><xbrli:identifier>01</xbrli:identifier></xbrli:entity>
    <xbrli:period><xbrli:startDate>2023-04-01</xbrli:startDate><xbrli:endDate>2024-03-31</xbrli:endDate></xbrli:period></xbrli:context>
  <xbrli:context id="bs"><xbrli:entity><xbrli:identifier>01</xbrli:identifier></xbrli:entity>
    <xbrli:period><xbrli:instant>2025-03-31</xbrli:instant></xbrli:period></xbrli:context>
  <xbrli:context id="bs-reserve"><xbrli:entity><xbrli:identifier>01</xbrli:identifier>
    <xbrli:segment><xbrldi:explicitMember dimension="core:EquityClassesDimension">core:RetainedEarningsAccumulatedLosses</xbrldi:explicitMember></xbrli:segment></xbrli:entity>
    <xbrli:period><xbrli:instant>2025-03-31</xbrli:instant></xbrli:period></xbrli:context>
</ix:resources></ix:header>
<td><ix:nonFraction name="core:TurnoverRevenue" contextRef="prev" unitRef="GBP" decimals="-3" scale="3" format="ixt2:numdotdecimal">9,876</ix:nonFraction></td>
<td><ix:nonFraction name="core:TurnoverRevenue" contextRef="cur" unitRef="GBP" decimals="-3" scale="3" format="ixt2:numdotdecimal">12,345</ix:nonFraction></td>
<td><ix:nonFraction name="core:Equity" contextRef="bs-reserve" unitRef="GBP" decimals="0" format="ixt2:numdotdecimal">999</ix:nonFraction></td>
<td>(<ix:nonFraction name="core:NetAssetsLiabilities" contextRef="bs" unitRef="GBP" decimals="0" sign="-" format="ixt2:numdotdecimal">4,500</ix:nonFraction>)</td>
</body></html>`

describe('parseIxbrlFigures', () => {
  it('reads the whole-company figures for the accounts date, applying scale and sign', () => {
    expect(parseIxbrlFigures(filing, '2025-03-31')).toEqual({
      periodEnd: '2025-03-31',
      turnover: 12_345_000,
      netAssets: -4_500,
    })
  })
  it('takes the latest tagged period when no accounts date is given', () => {
    expect(parseIxbrlFigures(filing).periodEnd).toBe('2025-03-31')
  })
  it('falls back to total equity, but never a dimensional (reserves column) fact', () => {
    const noNetAssets = filing.replace(/<td>\(<ix:nonFraction name="core:NetAssetsLiabilities"[\s\S]*?<\/td>/, '')
    expect(parseIxbrlFigures(noNetAssets, '2025-03-31').netAssets).toBeNull()
    const withEquity = noNetAssets.replace('</body>', '<ix:nonFraction name="uk-core:Equity" contextRef="bs" format="ixt2:numdotdecimal">7,000</ix:nonFraction></body>')
    expect(parseIxbrlFigures(withEquity, '2025-03-31').netAssets).toBe(7_000)
  })
  it('leaves turnover null when the filing tags none (small-company accounts, or untagged P&L)', () => {
    const noTurnover = filing.replace(/<td><ix:nonFraction name="core:TurnoverRevenue"[\s\S]*?<\/td>/g, '')
    expect(parseIxbrlFigures(noTurnover, '2025-03-31').turnover).toBeNull()
  })
  it('does not use a prior-year figure for the current year', () => {
    expect(parseIxbrlFigures(filing, '2024-03-31').turnover).toBe(9_876_000)
  })
})

describe('parseIxNumber', () => {
  it('handles the ixt number formats', () => {
    expect(parseIxNumber('1,234.5', 'ixt2:numdotdecimal')).toBe(1234.5)
    expect(parseIxNumber('1.234,5', 'ixt2:numcommadecimal')).toBe(1234.5)
    expect(parseIxNumber('-', 'ixt2:zerodash')).toBe(0)
    expect(parseIxNumber('<span>12</span> 000', null)).toBe(12000)
    expect(parseIxNumber('', null)).toBeNull()
  })
})
