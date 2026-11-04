import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const folders = [
  '.',
  'packages/editor-react',
  'packages/editor-plugin-docx',
  'packages/editor-plugin-spreadsheet',
  'packages/agent-core',
]
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version

function exportTargets(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(exportTargets)
}

for (const folder of folders) {
  const directory = resolve(root, folder)
  const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
  assert.equal(pkg.version, version, `${pkg.name}: version differs from core`)
  assert.equal(pkg.publishConfig.access, 'public', `${pkg.name}: expected public access`)
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/')
  if (pkg.peerDependencies?.['@langeditor/core']) {
    assert.equal(pkg.peerDependencies['@langeditor/core'], `^${version}`, pkg.name)
  }
  const targets = [pkg.main, pkg.module, pkg.types, ...exportTargets(pkg.exports)].filter(Boolean)
  for (const target of new Set(targets)) {
    assert.ok(statSync(resolve(directory, target)).isFile(), `${pkg.name}: missing ${target}`)
  }
  console.log(`${pkg.name}@${version}: export files verified`)
}
