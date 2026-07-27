// 확장 개발 호스트 안에서 실행되는 테스트 러너 (mocha 없이 최소 구현).
// @vscode/test-electron이 이 파일의 run()을 호출한다.
const assert = require('node:assert/strict')
const vscode = require('vscode')

const EXT_ID = 's6xybr8in.cplog-vscode'

const results = []
async function check(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`PASS — ${name}`)
  } catch (err) {
    results.push({ name, ok: false, err })
    console.log(`FAIL — ${name} :: ${err.message}`)
  }
}

const labelOf = (item) => (typeof item.label === 'string' ? item.label : item.label?.label)

async function run() {
  const ext = vscode.extensions.getExtension(EXT_ID)
  assert.ok(ext, `익스텐션(${EXT_ID})을 찾지 못했습니다`)
  const api = await ext.activate()

  await check('활성화되고 내부 API를 노출한다', () => {
    assert.ok(api._provider && api._state && api._statusBar)
  })

  await check('명령이 전부 등록된다', async () => {
    const all = await vscode.commands.getCommands(true)
    for (const id of [
      'cplog.refresh',
      'cplog.setup',
      'cplog.setToken',
      'cplog.toggleShowDone',
      'cplog.openProblem',
      'cplog.createProblemFile',
    ]) {
      assert.ok(all.includes(id), `${id} 미등록`)
    }
  })

  await check('설정 전에는 빈 트리를 반환한다 (viewsWelcome 노출 조건)', async () => {
    api._state.configured = false
    assert.deepEqual(await api._provider.getChildren(), [])
  })

  // 네트워크 없이 상태만 주입해 렌더 결과를 검증한다
  const NOW = Date.now()
  api._state.configured = true
  api._state.showDone = false
  api._state.error = null
  api._state.problems = [
    { id: 'a', name: 'CF 1850A', platform: 'Codeforces', difficulty: '800', group: '연습 2', status: 'todo', createdAt: 100, tags: ['DP'] },
    { id: 'b', name: 'CF 1850B', platform: 'Codeforces', difficulty: '1200', group: '연습 2', status: 'done', createdAt: 200 },
    { id: 'c', name: 'CF 1900C', platform: 'Codeforces', group: '연습 10', status: 'todo', createdAt: 300, url: 'https://codeforces.com/problemset/problem/1900/C' },
    { id: 'd', name: '기타 문제', platform: 'BOJ', group: '', status: 'todo', createdAt: 400, reviewAt: NOW - 1000 },
  ]

  let groups
  await check('그룹 섹션이 이름 자연 정렬 + "그룹 없음" 맨 뒤로 나온다', async () => {
    groups = await api._provider.getChildren()
    assert.deepEqual(groups.map(labelOf), ['연습 2', '연습 10', '그룹 없음'])
  })

  await check('그룹 헤더에 진행도가 표시된다', () => {
    assert.equal(groups[0].description, '1/2 해결')
  })

  await check('그룹을 펼치면 문제 노드가 나온다', async () => {
    const rows = await api._provider.getChildren(groups[0])
    assert.deepEqual(rows.map(labelOf), ['CF 1850A'], 'showDone=false라 done은 빠진다')
    assert.equal(rows[0].description, 'Codeforces · 800')
    assert.equal(rows[0].contextValue, 'cplogProblem')
  })

  await check('URL 있는 문제만 클릭 명령이 붙는다', async () => {
    const withUrl = (await api._provider.getChildren(groups[1]))[0]
    const withoutUrl = (await api._provider.getChildren(groups[0]))[0]
    assert.equal(withUrl.command?.command, 'cplog.openProblem')
    assert.equal(withoutUrl.command, undefined)
  })

  await check('복습 기한이 지난 문제는 bell-dot 아이콘', async () => {
    const row = (await api._provider.getChildren(groups[2]))[0]
    assert.equal(row.iconPath.id, 'bell-dot')
  })

  await check('showDone을 켜면 해결한 문제가 나타난다', async () => {
    api._state.showDone = true
    const rows = await api._provider.getChildren((await api._provider.getChildren())[0])
    assert.deepEqual(rows.map(labelOf), ['CF 1850A', 'CF 1850B'])
    assert.equal(rows[1].iconPath.id, 'check')
    api._state.showDone = false
  })

  await check('오류가 있으면 목록을 지우지 않고 맨 위에 알림 항목을 넣는다', async () => {
    api._state.error = { code: 'NETWORK', message: '네트워크 오류: test' }
    const items = await api._provider.getChildren()
    assert.equal(labelOf(items[0]), '네트워크 오류: test')
    assert.equal(items[0].iconPath.id, 'error')
    assert.equal(items.length, 4, '오류 1줄 + 그룹 3개 — 캐시된 목록이 유지돼야 한다')
    api._state.error = null
  })

  await check('그룹이 없으면 평면 목록으로 나온다', async () => {
    api._state.problems = [{ id: 'x', name: '단독 문제', platform: 'BOJ', status: 'todo', createdAt: 1 }]
    const items = await api._provider.getChildren()
    assert.deepEqual(items.map(labelOf), ['단독 문제'])
    assert.equal(items[0].contextValue, 'cplogProblem')
  })

  await check('풀 문제가 없으면 안내 항목을 보여준다', async () => {
    api._state.problems = [{ id: 'x', name: '끝난 문제', status: 'done', createdAt: 1 }]
    const items = await api._provider.getChildren()
    assert.equal(items.length, 1)
    assert.equal(labelOf(items[0]), '풀어야 할 문제가 없습니다')
  })

  await check('상태바에 미해결/복습 개수가 반영된다', async () => {
    api._state.problems = [
      { id: '1', name: 'a', status: 'todo', createdAt: 1 },
      { id: '2', name: 'b', status: 'todo', createdAt: 2, reviewAt: NOW - 5 },
      { id: '3', name: 'c', status: 'done', createdAt: 3 },
    ]
    await vscode.commands.executeCommand('cplog.toggleShowDone')
    await vscode.commands.executeCommand('cplog.toggleShowDone') // 원복 겸 render() 유발
    assert.match(api._statusBar.text, /To Solve 2/)
    assert.match(api._statusBar.text, /복습 1/)
  })

  await check('깨진 problems.json에도 트리가 죽지 않는다', async () => {
    api._state.problems = ['nope', null, 42]
    const items = await api._provider.getChildren()
    assert.equal(items.length, 1)
    assert.equal(labelOf(items[0]), '풀어야 할 문제가 없습니다')
  })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 통과`)
  if (failed.length) throw new Error(`${failed.length}개 실패:\n${failed.map((f) => `  - ${f.name}: ${f.err.stack}`).join('\n')}`)
}

module.exports = { run }
