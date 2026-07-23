// 실제 VS Code를 내려받아 확장 개발 호스트에서 test/integration/index.js를 돌린다.
import { runTests } from '@vscode/test-electron'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

try {
  await runTests({
    extensionDevelopmentPath: resolve(here, '..'),
    extensionTestsPath: resolve(here, 'integration', 'index.js'),
    // 사용자 설정/다른 익스텐션의 영향을 받지 않게 격리
    launchArgs: ['--disable-extensions', '--disable-gpu', '--no-sandbox'],
  })
} catch (err) {
  console.error('통합 테스트 실패:', err?.message || err)
  process.exit(1)
}
