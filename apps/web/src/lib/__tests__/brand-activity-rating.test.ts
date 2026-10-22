import { articleText, isFetchableUrl } from '../brand-activity-rating'

describe('isFetchableUrl', () => {
  it('fetches public news sites only', () => {
    expect(isFetchableUrl('https://www.retailgazette.co.uk/blog/2026/10/aldi')).toBe(true)
    expect(isFetchableUrl('http://example.com/a')).toBe(true)
    expect(isFetchableUrl('ftp://example.com/a')).toBe(false)
    expect(isFetchableUrl('http://localhost:3000/x')).toBe(false)
    expect(isFetchableUrl('http://169.254.169.254/latest')).toBe(false)
    expect(isFetchableUrl('http://[::1]/')).toBe(false)
    expect(isFetchableUrl('http://intranet/')).toBe(false)
    expect(isFetchableUrl('not a url')).toBe(false)
  })
})

describe('articleText', () => {
  it('keeps the words and drops markup, scripts and navigation', () => {
    const html =
      '<html><head><style>p{}</style><script>var x = 1</script></head><body><nav>Home News</nav>' +
      '<h1>Aldi&nbsp;to open 30 stores</h1><p>The grocer&rsquo;s plan &amp; timetable.</p></body></html>'
    expect(articleText(html)).toBe("Aldi to open 30 stores The grocer's plan & timetable.")
  })
})
