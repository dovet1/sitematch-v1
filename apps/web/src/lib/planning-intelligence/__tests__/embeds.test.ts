import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * `development_applications` has two foreign keys to `developments` since migration 20261011
 * (`development_id` and `previous_development_id`), so an embed that does not name its key fails
 * with PGRST201 at runtime. One such embed in classify.ts stopped all planning classification from
 * 15 September to 14 October 2026 without a single failed run being recorded.
 */
const web = path.resolve(__dirname, '../../../..')
// Embedding developments from development_applications, or development_applications from developments.
const AMBIGUOUS_DEVELOPMENTS = /\bdevelopments\(/
const AMBIGUOUS_MEMBERSHIPS = /from\('developments'\).*\bdevelopment_applications\(/

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === '__tests__' ? [] : sources(full)
    return /\.(ts|tsx|mjs)$/.test(entry.name) ? [full] : []
  })
}

describe('embeds between developments and development_applications', () => {
  it('always name the foreign key they follow', () => {
    const offenders = [...sources(path.join(web, 'src')), ...sources(path.join(web, 'scripts'))].flatMap(file =>
      readFileSync(file, 'utf8').split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => AMBIGUOUS_DEVELOPMENTS.test(line) || AMBIGUOUS_MEMBERSHIPS.test(line))
        .map(({ index }) => `${path.relative(web, file)}:${index + 1}`))
    expect(offenders).toEqual([])
  })
})
