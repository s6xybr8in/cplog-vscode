// problems.json 배열 → 사이드바 트리 구조.
//
// 순수 함수만 둔다 (vscode 모듈을 import하지 않음) — VS Code 없이 단위 테스트할 수 있다.
// 정렬·그룹 규칙은 CP-Log 웹앱의 ProblemTable과 동일해야 한다. 순서가 다르면 혼란스럽다.

// 그룹 이름과 충돌하지 않는 예약 문자열 (웹앱과 같은 값)
const UNGROUPED_KEY = '__cplog_ungrouped__'
const UNGROUPED_LABEL = '그룹 없음'

// 미해결이 위, 끝난 문제가 아래
const STATUS_ORDER = { todo: 0, done: 1 }

// 상태는 todo/done 2가지. 예전 데이터에 남아 있는 in_progress 등은 전부 todo로 취급한다
// (웹앱도 마운트 시 todo로 승격시킨다).
function normalizeStatus(status) {
  return status === 'done' ? 'done' : 'todo'
}

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback)
const num = (v, fallback = null) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

// 스키마는 웹앱이 정의한다 — 모르는 필드는 버리고, 빠진 필드는 기본값으로 채워
// 어떤 입력에도 throw하지 않는다 (웹앱이 스키마를 바꿔도 목록이 통째로 죽지 않게).
function normalizeProblems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p) => p && typeof p === 'object' && !Array.isArray(p))
    .map((p) => ({
      id: str(p.id),
      name: str(p.name).trim() || '(이름 없음)',
      url: str(p.url),
      platform: str(p.platform, 'Other') || 'Other',
      difficulty: p.difficulty == null ? '' : String(p.difficulty),
      tags: Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string') : [],
      group: str(p.group),
      status: normalizeStatus(p.status),
      createdAt: num(p.createdAt, 0),
      reviewAt: num(p.reviewAt),
      solvedAt: num(p.solvedAt),
    }))
}

function isReviewDue(problem, now) {
  return problem.reviewAt != null && now >= problem.reviewAt
}

// 미해결 우선, 같은 상태 안에서는 최신 등록순
function sortRows(rows) {
  return [...rows].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1) || (b.createdAt || 0) - (a.createdAt || 0),
  )
}

/**
 * @returns {{
 *   sections: Array<{ key: string|null, name: string, named: boolean, rows: object[], done: number, total: number }>,
 *   flat: boolean,
 *   counts: { todo: number, done: number, reviewDue: number, total: number }
 * }}
 * `flat`이면 섹션 헤더 없이 sections[0].rows를 그대로 보여준다.
 */
function buildTree(rawProblems, { showDone = false, now = Date.now() } = {}) {
  const problems = normalizeProblems(rawProblems)

  const counts = {
    total: problems.length,
    todo: problems.filter((p) => p.status === 'todo').length,
    done: problems.filter((p) => p.status === 'done').length,
    // 복습 배지는 상태와 무관하게 기한이 도래한 전부 (웹앱 사이드바 배지와 같은 계산)
    reviewDue: problems.filter((p) => isReviewDue(p, now)).length,
  }

  // 진행도(done/total)는 숨긴 항목까지 포함해 세야 하므로 필터 전에 그룹을 나눈다
  const byGroup = new Map()
  for (const p of problems) {
    if (!byGroup.has(p.group)) byGroup.set(p.group, [])
    byGroup.get(p.group).push(p)
  }

  const visible = (rows) => sortRows(showDone ? rows : rows.filter((p) => p.status !== 'done'))
  const toSection = (key, name, named, rows) => ({
    key,
    name,
    named,
    rows: visible(rows),
    done: rows.filter((p) => p.status === 'done').length,
    total: rows.length,
  })

  const named = [...byGroup.entries()]
    .filter(([g]) => g)
    // "새 그룹 2" < "새 그룹 10" — 숫자를 자연 정렬.
    // 로케일은 웹앱과 같이 런타임 기본값(undefined)을 쓴다. ko-KR에선 한글이 라틴보다 앞이라
    // 스크립트가 섞이면 순서가 로케일에 따라 달라지지만, 웹앱과 같은 정책이라 그대로 둔다.
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([g, rows]) => toSection(g, g, true, rows))

  // 이름 있는 그룹이 하나도 없으면 섹션 없이 평면 목록
  if (!named.length) {
    return { sections: [toSection(null, '', false, problems)], flat: true, counts }
  }

  const sections = [...named]
  if (byGroup.has('')) sections.push(toSection(UNGROUPED_KEY, UNGROUPED_LABEL, false, byGroup.get('')))

  // 전부 해결된 그룹은 To Solve 목록에서 사라지는 게 맞다 (showDone이면 다시 보인다)
  return { sections: sections.filter((s) => s.rows.length), flat: false, counts }
}

module.exports = { buildTree, normalizeProblems, isReviewDue, sortRows, UNGROUPED_KEY, UNGROUPED_LABEL }
