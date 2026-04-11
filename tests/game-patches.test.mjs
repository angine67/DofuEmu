import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const tmpDir = path.join(root, 'tests/.tmp')

function setup() {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(tmpDir, 'build'), { recursive: true })

  for (const file of ['index.html', 'fixes.js', 'fixes.css', 'regex.json']) {
    fs.copyFileSync(
      path.join(root, 'packages/main/game-base', file),
      path.join(tmpDir, file)
    )
  }

  console.log('Downloading fresh script.js...')
  execSync(`curl -s "https://dt-proxy-production-login.ankama-games.com/build/script.js" -o "${path.join(tmpDir, 'build/script.js')}"`, { timeout: 30000 })
  execSync(`curl -s "https://dt-proxy-production-login.ankama-games.com/build/styles-native.css" -o "${path.join(tmpDir, 'build/styles-native.css')}"`, { timeout: 30000 })
  console.log('Downloaded.')
}

function applyRegexPatches() {
  const regexPath = path.join(tmpDir, 'regex.json')
  const regex = JSON.parse(fs.readFileSync(regexPath, 'utf-8'))
  const results = {}

  for (const filename in regex) {
    const filePath = path.join(tmpDir, filename)
    if (!fs.existsSync(filePath)) continue
    let content = fs.readFileSync(filePath, 'utf-8')
    let applied = 0
    for (const [pattern, replacement] of regex[filename]) {
      const before = content
      content = content.replace(new RegExp(pattern, 'g'), replacement)
      if (content !== before) applied++
    }
    fs.writeFileSync(filePath, content)
    results[filename] = { applied, total: regex[filename].length }
  }
  return results
}

function applyProcessGamePatches() {
  const buildPath = path.join(tmpDir, 'build/script.js')
  let build = fs.readFileSync(buildPath, 'utf-8')
  const results = []

  if (!build.includes('$_haapiModule')) {
    const m = build.match(/(\w)\.getHaapiKeyManager\s*=\s*function\s*\(\)/)
    if (m) {
      build = build.replace(m[0], `window.$_haapiModule=${m[1]},${m[0]}`)
      results.push('$_haapiModule')
    }
  }

  if (!build.includes('$_authManager')) {
    const m = build.match(/(\w)\.requestWebAuthToken\s*=\s*function/)
    if (m) {
      build = build.replace(m[0], `window.$_authManager=${m[1]},${m[0]}`)
      results.push('$_authManager')
    }
  }

  if (!build.includes('$_haapiAccount')) {
    const m = build.match(/(\w)\.account\s*=\s*new\s+(\w)\((\w),\s*(\w)\)/)
    if (m) {
      build = build.replace(m[0], `${m[0]},window.$_haapiAccount=${m[1]}.account`)
      results.push('$_haapiAccount')
    }
  }

  fs.writeFileSync(buildPath, build)
  return results
}

function runTests() {
  let passed = 0
  let failed = 0

  function test(name, fn) {
    try {
      fn()
      console.log(`  \u2713 ${name}`)
      passed++
    } catch (e) {
      console.log(`  \u2717 ${name}: ${e.message}`)
      failed++
    }
  }

  // --- Game base files ---
  console.log('\nGame base files:')

  test('index.html exists and has cordova mock', () => {
    const html = fs.readFileSync(path.join(tmpDir, 'index.html'), 'utf-8')
    assert(html.includes('window.cordova'), 'missing cordova mock')
    assert(html.includes('InAppBrowser'), 'missing InAppBrowser mock')
    assert(html.includes('initDofus'), 'missing initDofus')
    assert(html.includes('$appSchemeLinkCalled'), 'missing $appSchemeLinkCalled')
    assert(html.includes('IonicDeeplink'), 'missing IonicDeeplink mock')
    assert(html.includes('browsertab'), 'missing browsertab mock')
    assert(html.includes('_deepLinkCallbacks'), 'missing deeplink callback bridge')
  })

  test('fixes.js has mouse-to-touch conversion', () => {
    const fixes = fs.readFileSync(path.join(tmpDir, 'fixes.js'), 'utf-8')
    assert(fixes.includes('TouchEvent'), 'missing TouchEvent creation')
    assert(fixes.includes('mousedown'), 'missing mousedown handler')
  })

  test('fixes.css has base styles', () => {
    const css = fs.readFileSync(path.join(tmpDir, 'fixes.css'), 'utf-8')
    assert(css.includes('background: black'), 'missing background')
    assert(css.includes('scrollbar'), 'missing scrollbar styles')
  })

  // --- Regex patches ---
  console.log('\nRegex patches:')
  const regexResults = applyRegexPatches()

  test('script.js regex patches all applied', () => {
    const r = regexResults['build/script.js']
    assert(r, 'no script.js results')
    assert(r.applied === r.total, `only ${r.applied}/${r.total} patches applied`)
  })

  test('script.js is valid syntax after regex patches', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    new Function(src)
  })

  test('singletons exposed via regex', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    assert(src.includes('window.singletons'), 'missing window.singletons')
  })

  test('analytics disabled', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    assert(!src.includes('window.Config.analytics'), 'analytics not replaced with null')
  })

  test('client set to android', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    assert(src.includes('client:"android"'), 'client not set to android')
  })

  // --- processGame patches ---
  console.log('\nprocessGame patches:')
  const pgResults = applyProcessGamePatches()

  test('$_haapiModule exposed', () => {
    assert(pgResults.includes('$_haapiModule'), '$_haapiModule not patched')
  })

  test('$_authManager exposed', () => {
    assert(pgResults.includes('$_authManager'), '$_authManager not patched')
  })

  test('script.js still valid after processGame patches', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    new Function(src)
  })

  // --- Auth flow ---
  console.log('\nAuth flow:')

  test('game has loginWithHaapiKey', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    assert(src.includes('loginWithHaapiKey'), 'missing loginWithHaapiKey')
  })

  test('game has requestWebAuthToken', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    assert(src.includes('requestWebAuthToken'), 'missing requestWebAuthToken')
  })

  test('game has CODE_VERIFIER storage', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    assert(src.includes('CODE_VERIFIER'), 'missing CODE_VERIFIER')
  })

  test('game uses deepLink for auth callback detection', () => {
    const src = fs.readFileSync(path.join(tmpDir, 'build/script.js'), 'utf-8')
    assert(src.includes('deepLink+"?code="'), 'missing deepLink code detection')
  })

  // --- Summary ---
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

setup()
runTests()
fs.rmSync(tmpDir, { recursive: true, force: true })
