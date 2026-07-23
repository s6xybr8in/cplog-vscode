import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildTree, normalizeProblems, isReviewDue, sortRows } = require('../src/tree.js')

const NOW = 1_800_000_000_000

const p = (over = {}) => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: 'CF 1850A',
  url: 'https://codeforces.com/problemset/problem/1850/A',
  platform: 'Codeforces',
  difficulty: '800',
  tags: [],
  group: '',
  status: 'todo',
  createdAt: NOW - 1000,
  reviewAt: null,
  ...over,
})

const names = (rows) => rows.map((r) => r.name)
const sectionNames = (t) => t.sections.map((s) => s.name)

// --- 그룹 섹션 ---------------------------------------------------------------

test('그룹 섹션은 이름 자연 정렬 — "새 그룹 2"가 "새 그룹 10"보다 앞', () => {
  const t = buildTree([p({ group: '새 그룹 10' }), p({ group: '새 그룹 2' }), p({ group: '새 그룹 1' })])
  assert.deepEqual(sectionNames(t), ['새 그룹 1', '새 그룹 2', '새 그룹 10'])
})

// 스크립트가 섞이면 순서는 로케일마다 다르다 (ko-KR에선 한글이 라틴보다 앞).
// 웹앱도 같은 정책(런타임 기본 로케일)이라 하드코딩 대신 localeCompare 기준으로 검증한다.
test('그룹 정렬은 코드포인트가 아니라 런타임 로케일 collation을 따른다', () => {
  const groups = ['DONE', '남음', 'ABC']
  const expected = [...groups].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const t = buildTree(groups.map((g) => p({ group: g })))
  assert.deepEqual(sectionNames(t), expected)
})

test('"그룹 없음" 섹션은 항상 맨 뒤', () => {
  const t = buildTree([p({ group: '' }), p({ group: 'ZZZ' }), p({ group: 'AAA' })])
  assert.deepEqual(sectionNames(t), ['AAA', 'ZZZ', '그룹 없음'])
  assert.equal(t.flat, false)
})

test('이름 있는 그룹이 하나도 없으면 섹션 없이 평면 목록', () => {
  const t = buildTree([p({ group: '' }), p({ group: '' })])
  assert.equal(t.flat, true)
  assert.equal(t.sections.length, 1)
  assert.equal(t.sections[0].rows.length, 2)
})

test('그룹 진행도는 숨긴 done까지 포함해 센다', () => {
  const rows = [
    p({ group: 'G', status: 'done' }),
    p({ group: 'G', status: 'done' }),
    p({ group: 'G', status: 'todo' }),
    p({ group: '기타', status: 'todo' }),
  ]
  const t = buildTree(rows, { showDone: false })
  const g = t.sections.find((s) => s.name === 'G')
  assert.equal(g.done, 2)
  assert.equal(g.total, 3)
  assert.equal(g.rows.length, 1, 'showDone=false면 보이는 행은 미해결 1개')
})

test('전부 해결된 그룹은 showDone=false에서 사라지고, 켜면 다시 보인다', () => {
  const rows = [p({ group: 'DONE', status: 'done' }), p({ group: '남음', status: 'todo' })]
  assert.deepEqual(sectionNames(buildTree(rows, { showDone: false })), ['남음'])
  const shown = sectionNames(buildTree(rows, { showDone: true }))
  assert.equal(shown.length, 2)
  assert.ok(shown.includes('DONE') && shown.includes('남음'))
})

// --- 행 정렬 -----------------------------------------------------------------

test('행은 미해결 우선, 같은 상태 안에서는 최신 등록순', () => {
  const rows = [
    p({ name: 'old-todo', status: 'todo', createdAt: 100 }),
    p({ name: 'done-new', status: 'done', createdAt: 900 }),
    p({ name: 'new-todo', status: 'todo', createdAt: 500 }),
    p({ name: 'done-old', status: 'done', createdAt: 200 }),
  ]
  assert.deepEqual(names(sortRows(rows)), ['new-todo', 'old-todo', 'done-new', 'done-old'])
})

test('showDone=false면 done 행이 빠진다', () => {
  const t = buildTree([p({ name: 'a', status: 'todo' }), p({ name: 'b', status: 'done' })])
  assert.deepEqual(names(t.sections[0].rows), ['a'])
  assert.deepEqual(names(buildTree([p({ name: 'a' }), p({ name: 'b', status: 'done' })], { showDone: true }).sections[0].rows), ['a', 'b'])
})

// --- 레거시/방어적 파싱 -------------------------------------------------------

test('레거시 in_progress 값은 todo로 취급', () => {
  const [row] = normalizeProblems([{ name: 'x', status: 'in_progress' }])
  assert.equal(row.status, 'todo')
  assert.equal(buildTree([{ name: 'x', status: 'in_progress' }]).counts.todo, 1)
})

test('배열이 아니거나 깨진 입력에서도 throw하지 않는다', () => {
  for (const bad of [null, undefined, {}, 'nope', 42, [null, 'x', 3, []]]) {
    const t = buildTree(bad)
    assert.equal(t.counts.total, 0)
    assert.equal(t.sections[0].rows.length, 0)
  }
})

test('필드가 빠져도 기본값으로 채운다', () => {
  const [row] = normalizeProblems([{}])
  assert.equal(row.name, '(이름 없음)')
  assert.equal(row.platform, 'Other')
  assert.deepEqual(row.tags, [])
  assert.equal(row.group, '')
  assert.equal(row.status, 'todo')
  assert.equal(row.reviewAt, null)
})

test('difficulty가 숫자로 와도 문자열로 정규화', () => {
  assert.equal(normalizeProblems([{ difficulty: 1600 }])[0].difficulty, '1600')
  assert.equal(normalizeProblems([{ difficulty: null }])[0].difficulty, '')
})

test('모르는 필드는 버린다', () => {
  const [row] = normalizeProblems([{ name: 'x', 새필드: 1 }])
  assert.equal(row.새필드, undefined)
})

// --- 복습 기한 ---------------------------------------------------------------

test('복습 기한 도래 판정 — now === reviewAt는 도래로 본다', () => {
  assert.equal(isReviewDue({ reviewAt: NOW }, NOW), true)
  assert.equal(isReviewDue({ reviewAt: NOW + 1 }, NOW), false)
  assert.equal(isReviewDue({ reviewAt: null }, NOW), false)
})

test('복습 개수는 상태와 무관하게 센다', () => {
  const t = buildTree(
    [
      p({ status: 'done', reviewAt: NOW - 1 }),
      p({ status: 'todo', reviewAt: NOW - 1 }),
      p({ status: 'todo', reviewAt: NOW + 100000 }),
    ],
    { now: NOW },
  )
  assert.equal(t.counts.reviewDue, 2)
})

test('counts는 필터와 무관하게 전체 기준', () => {
  const rows = [p({ status: 'todo' }), p({ status: 'done' }), p({ status: 'done' })]
  const t = buildTree(rows, { showDone: false })
  assert.deepEqual({ ...t.counts, reviewDue: 0 }, { total: 3, todo: 1, done: 2, reviewDue: 0 })
})
