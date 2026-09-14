/** Build an isolated deployable project from an explicit source allowlist.
 * node apps/web/scripts/package-planning-workers.mjs /tmp/planning-workers-build
 * Add --scheduled only after verifying the deployed jobs. No credentials are copied.
 */
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destination = process.argv[2]
if (!destination || !path.isAbsolute(destination)) throw new Error('Supply a new absolute destination directory')
await mkdir(destination) // Refuse to overwrite an existing deployment or its settings.
const write = async (file, content) => {
  await mkdir(path.dirname(path.join(destination, file)), { recursive: true })
  await writeFile(path.join(destination, file), content)
}
const sources = [
  ...['ingest', 'plota', 'eligibility', 'types', 'db', 'classify', 'budget', 'openrouter', 'discovery-lane-route']
    .map(name => `src/lib/planning-intelligence/${name}.ts`),
  'src/lib/epc/aliases.ts', 'src/lib/epc/normalise.ts',
  ...['sync-plota', 'sync-plota-late', 'sync-plota-deep', 'refresh-plota', 'classify-planning']
    .map(name => `src/app/api/cron/${name}/route.ts`),
]
for (const file of sources) {
  await mkdir(path.dirname(path.join(destination, file)), { recursive: true })
  await copyFile(path.join(web, file), path.join(destination, file))
}
await write('package.json', JSON.stringify({
  name: 'sitematch-planning-workers', version: '1.0.0', private: true,
  scripts: { build: 'next build', start: 'next start' },
  dependencies: { next: '15.5.9', react: '19.2.0', 'react-dom': '19.2.0',
    '@supabase/supabase-js': '2.75.0', zod: '3.25.76', 'server-only': '0.0.1' },
  devDependencies: { typescript: '5.9.3', '@types/node': '20.19.19', '@types/react': '19.2.17' },
}, null, 2) + '\n')
await write('tsconfig.json', JSON.stringify({ compilerOptions: {
  target: 'es2017', lib: ['dom', 'esnext'], strict: true, noEmit: true,
  skipLibCheck: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler',
  resolveJsonModule: true, isolatedModules: true, jsx: 'preserve', incremental: true,
  plugins: [{ name: 'next' }], paths: { '@/*': ['./src/*'] },
}, include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }, null, 2) + '\n')
await write('src/app/route.ts', "export function GET() { return Response.json({ service: 'planning-workers', status: 'ok' }) }\n")
await write('next.config.mjs', 'export default { poweredByHeader: false };\n')
await write('vercel.json', JSON.stringify({ framework: 'nextjs',
  crons: process.argv.includes('--scheduled') ? [
    { path: '/api/cron/sync-plota', schedule: '0 */3 * * *' },
    { path: '/api/cron/refresh-plota', schedule: '30 */6 * * *' },
    { path: '/api/cron/sync-plota-late', schedule: '45 */6 * * *' },
    { path: '/api/cron/sync-plota-deep', schedule: '5 1,13 * * *' },
    { path: '/api/cron/classify-planning', schedule: '15 * * * *' },
  ] : [],
}, null, 2) + '\n')
await write('.gitignore', 'node_modules\n.next\n.vercel\n.env*\n')
await write('.vercelignore', 'node_modules\n.next\n.env*\n')
console.log(JSON.stringify({ destination, sourceFiles: sources.length, scheduled: process.argv.includes('--scheduled') }))
