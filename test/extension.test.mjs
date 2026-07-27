// VS Code를 띄우지 않고 provider/extension을 실제로 실행한다 ('vscode' 모듈은 스텁).
// 확장 호스트가 필요한 검증(매니페스트·실제 렌더)은 test/integration이 맡는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { installVscodeStub, makeContext } from './vscodeStub.mjs'

const require = createRequire(import.meta.url)
const { vscode, state: env } = installVscodeStub()
const { activate } = require('../extension.js')

const NOW = Date.now()
const ROWS = [
  { id: 'a', name: 'CF 1850A', platform: 'Codeforces', difficulty: '800', group: '연습 2', status: 'todo', createdAt: 100, tags: ['DP'] },
  { id: 'b', name: 'CF 1850B', platform: 'Codeforces', difficulty: '1200', group: '연습 2', status: 'done', createdAt: 200 },
  { id: 'c', name: 'CF 1900C', platform: 'Codeforces', group: '연습 10', status: 'todo', createdAt: 300, url: 'https://codeforces.com/problemset/problem/1900/C' },
  { id: 'd', name: '기타', platform: 'BOJ', group: '', status: 'todo', createdAt: 400, reviewAt: NOW - 1000 },
]

const contentsBody = (rows) => ({
  ok: true,
  status: 200,
  json: async () => ({ sha: 's', content: Buffer.from(JSON.stringify(rows), 'utf8').toString('base64') }),
})

// 각 테스트가 깨끗한 상태에서 시작하도록 activate를 새로 돌린다
async function boot({ rows = ROWS, response, secrets = { 'cplog.pat': 'tok' }, globalState = {}, settings = {} } = {}) {
  env.commands.clear()
  env.context.clear()
  env.opened.length = 0
  env.errors.length = 0
  env.configListeners.length = 0
  env.files.clear()
  env.dirs.clear()
  env.shown.length = 0
  env.workspaceFolders = [{ uri: vscode.Uri.file('/ws'), name: 'ws', index: 0 }]
  env.settings.clear()
  env.settings.set('cplog.username', 's6xybr8in')
  env.settings.set('cplog.dataRepo', 'cplog-data')
  env.settings.set('cplog.refreshMinutes', 0) // 테스트 중 타이머가 돌지 않게
  for (const [k, v] of Object.entries(settings)) env.settings.set(k, v)

  globalThis.fetch = async () => response ?? contentsBody(rows)

  const ctx = makeContext({ secrets, globalState })
  const api = activate(ctx)
  await api._refresh()
  return { api, ctx }
}

const labelOf = (i) => (typeof i.label === 'string' ? i.label : i.label?.label)

test('활성화하면 명령이 전부 등록된다', async () => {
  await boot()
  for (const id of ['cplog.refresh', 'cplog.setup', 'cplog.setToken', 'cplog.toggleShowDone', 'cplog.openProblem', 'cplog.createProblemFile']) {
    assert.ok(env.commands.has(id), `${id} 미등록`)
  }
})

test('토큰이 없으면 네트워크를 타지 않고 configured=false 컨텍스트를 내보낸다', async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
    return contentsBody([])
  }
  const { api } = await boot({ secrets: {} })
  assert.equal(called, false)
  assert.equal(env.context.get('cplog.configured'), false)
  assert.deepEqual(await api._provider.getChildren(), [], '설정 전에는 빈 트리 → viewsWelcome 노출')
})

test('설정이 있으면 목록을 불러와 그룹 트리를 만든다', async () => {
  const { api } = await boot()
  assert.equal(env.context.get('cplog.configured'), true)
  const groups = await api._provider.getChildren()
  assert.deepEqual(groups.map(labelOf), ['연습 2', '연습 10', '그룹 없음'])
  assert.equal(groups[0].description, '1/2 해결')

  const rows = await api._provider.getChildren(groups[0])
  assert.deepEqual(rows.map(labelOf), ['CF 1850A'])
  assert.equal(rows[0].description, 'Codeforces · 800')
  assert.equal(rows[0].iconPath.id, 'circle-outline')
})

test('복습 기한이 지난 문제는 bell-dot, 해결한 문제는 check 아이콘', async () => {
  const { api } = await boot()
  const groups = await api._provider.getChildren()
  const due = (await api._provider.getChildren(groups[2]))[0]
  assert.equal(due.iconPath.id, 'bell-dot')
  assert.equal(due.iconPath.color.id, 'charts.yellow')

  api._state.showDone = true
  const done = (await api._provider.getChildren((await api._provider.getChildren())[0]))[1]
  assert.equal(done.iconPath.id, 'check')
})

test('상태바에 미해결/복습 개수가 표시된다', async () => {
  const { api } = await boot()
  assert.match(api._statusBar.text, /To Solve 3/)
  assert.match(api._statusBar.text, /복습 1/)
})

test('URL 있는 문제만 클릭 명령이 붙고, 명령이 브라우저를 연다', async () => {
  const { api } = await boot()
  const groups = await api._provider.getChildren()
  const withUrl = (await api._provider.getChildren(groups[1]))[0]
  const withoutUrl = (await api._provider.getChildren(groups[0]))[0]
  assert.equal(withoutUrl.command, undefined)
  assert.equal(withUrl.command.command, 'cplog.openProblem')

  await vscode.commands.executeCommand('cplog.openProblem', withUrl)
  assert.deepEqual(env.opened, ['https://codeforces.com/problemset/problem/1900/C'])
})

// 트리에서 첫 그룹의 첫 문제 노드(= 'CF 1850A')
const firstProblem = async (api) => (await api._provider.getChildren((await api._provider.getChildren())[0]))[0]

test('문제 파일 만들기가 워크스페이스 루트에 .cpp를 만들고 연다 (공백은 밑줄)', async () => {
  const { api } = await boot()
  await vscode.commands.executeCommand('cplog.createProblemFile', await firstProblem(api))
  assert.deepEqual([...env.files.keys()], ['/ws/CF_1850A.cpp'])
  assert.deepEqual(env.shown, ['/ws/CF_1850A.cpp'])
})

test('fileExtension·fileDirectory 설정을 따르고 폴더를 만든다', async () => {
  const { api } = await boot({ settings: { 'cplog.fileExtension': '.py', 'cplog.fileDirectory': 'solutions/cf' } })
  await vscode.commands.executeCommand('cplog.createProblemFile', await firstProblem(api))
  assert.deepEqual([...env.files.keys()], ['/ws/solutions/cf/CF_1850A.py'])
  assert.ok(env.dirs.has('/ws/solutions/cf'))
})

test('이미 있는 파일은 덮어쓰지 않고 열기만 한다', async () => {
  const { api } = await boot()
  const kept = new TextEncoder().encode('int main() {}')
  env.files.set('/ws/CF_1850A.cpp', kept)
  await vscode.commands.executeCommand('cplog.createProblemFile', await firstProblem(api))
  assert.equal(env.files.get('/ws/CF_1850A.cpp'), kept, '풀던 코드를 날리면 안 된다')
  assert.deepEqual(env.shown, ['/ws/CF_1850A.cpp'])
})

test('파일명에 쓸 수 없는 글자는 정리한다', async () => {
  const { api } = await boot({ rows: [{ id: 'z', name: 'BOJ 1000: A/B?', status: 'todo', createdAt: 1 }] })
  const items = await api._provider.getChildren()
  await vscode.commands.executeCommand('cplog.createProblemFile', items[0])
  assert.deepEqual([...env.files.keys()], ['/ws/BOJ_1000_A_B.cpp'])
})

test('열린 폴더가 없으면 파일을 만들지 않고 오류를 알린다', async () => {
  const { api } = await boot()
  const item = await firstProblem(api)
  env.workspaceFolders = []
  await vscode.commands.executeCommand('cplog.createProblemFile', item)
  assert.equal(env.files.size, 0)
  assert.match(env.errors.at(-1), /폴더/)
})

test('showDone 토글이 설정에 반영되고 목록이 늘어난다', async () => {
  const { api } = await boot()
  assert.equal((await api._provider.getChildren(( await api._provider.getChildren())[0])).length, 1)
  await vscode.commands.executeCommand('cplog.toggleShowDone')
  assert.equal(env.settings.get('cplog.showDone'), true)
  assert.equal((await api._provider.getChildren((await api._provider.getChildren())[0])).length, 2)
})

test('불러오기 실패해도 캐시된 목록을 유지하고 오류를 맨 위에 알린다', async () => {
  const { api } = await boot({ globalState: { 'cplog.cache': { problems: ROWS } }, response: { ok: false, status: 500, json: async () => ({}) } })
  const items = await api._provider.getChildren()
  assert.equal(items[0].iconPath.id, 'error')
  assert.match(labelOf(items[0]), /500/)
  assert.equal(items.length, 4, '오류 1줄 + 캐시된 그룹 3개')
})

test('성공하면 globalState에 캐시한다', async () => {
  const { ctx } = await boot()
  assert.deepEqual(ctx._globalMap.get('cplog.cache').problems, ROWS)
})

test('토큰 설정 명령이 SecretStorage에 저장하고 다시 불러온다', async () => {
  const { api, ctx } = await boot({ secrets: {} })
  assert.equal(env.context.get('cplog.configured'), false)
  env.inputQueue.push('새-토큰')
  await vscode.commands.executeCommand('cplog.setToken')
  assert.equal(ctx._secretMap.get('cplog.pat'), '새-토큰')
  assert.equal(env.context.get('cplog.configured'), true)
  assert.equal((await api._provider.getChildren()).length, 3)
})

test('초기 설정 마법사가 사용자명·리포·토큰을 저장한다', async () => {
  const { ctx } = await boot({ secrets: {} })
  env.inputQueue.push('someone', 'my-data', 'tok2')
  await vscode.commands.executeCommand('cplog.setup')
  assert.equal(env.settings.get('cplog.username'), 'someone')
  assert.equal(env.settings.get('cplog.dataRepo'), 'my-data')
  assert.equal(ctx._secretMap.get('cplog.pat'), 'tok2')
})

test('마법사를 Esc로 취소하면 아무것도 저장하지 않는다', async () => {
  const { ctx } = await boot({ secrets: {} })
  env.inputQueue.push(undefined) // 첫 단계에서 취소
  await vscode.commands.executeCommand('cplog.setup')
  assert.equal(env.settings.get('cplog.username'), 's6xybr8in', '기존 값 유지')
  assert.equal(ctx._secretMap.has('cplog.pat'), false)
})

test('깨진 problems.json은 PARSE 오류로 알리고 트리는 죽지 않는다', async () => {
  const broken = { ok: true, status: 200, json: async () => ({ sha: 's', content: Buffer.from('{nope', 'utf8').toString('base64') }) }
  const { api } = await boot({ response: broken })
  const items = await api._provider.getChildren()
  assert.equal(items[0].iconPath.id, 'error')
  assert.ok(items.length >= 1)
})
