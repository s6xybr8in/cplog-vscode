import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { fetchProblems, DataRepoError } = require('../src/dataRepo.js')

const CONFIG = { username: 's6xybr8in', dataRepo: 'cplog-data', dataBranch: 'main', pat: 'ghp_test' }

// GitHub Contents API 응답 흉내 — 실제로 줄바꿈이 섞인 base64를 준다
const contentsResponse = (obj) => ({
  ok: true,
  status: 200,
  json: async () => ({
    sha: 'abc123',
    content: Buffer.from(JSON.stringify(obj), 'utf8').toString('base64').replace(/(.{60})/g, '$1\n'),
  }),
})

const stub = (response) => {
  const calls = []
  const fetch = async (url, opts) => {
    calls.push({ url, opts })
    return typeof response === 'function' ? response(url, opts) : response
  }
  return { fetch, calls }
}

test('올바른 URL과 헤더로 요청한다', async () => {
  const { fetch, calls } = stub(contentsResponse([]))
  await fetchProblems(CONFIG, { fetch })

  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/s6xybr8in/cplog-data/contents/problems.json?ref=main',
  )
  const headers = calls[0].opts.headers
  assert.equal(headers.Authorization, 'Bearer ghp_test')
  assert.equal(headers.Accept, 'application/vnd.github+json')
})

test('X-GitHub-Api-Version 헤더를 보내지 않는다 (웹앱 제약과 동일)', async () => {
  const { fetch, calls } = stub(contentsResponse([]))
  await fetchProblems(CONFIG, { fetch })
  const keys = Object.keys(calls[0].opts.headers).map((k) => k.toLowerCase())
  assert.ok(!keys.includes('x-github-api-version'), `보낸 헤더: ${keys.join(', ')}`)
})

test('브랜치 설정이 ref로 들어간다', async () => {
  const { fetch, calls } = stub(contentsResponse([]))
  await fetchProblems({ ...CONFIG, dataBranch: 'dev' }, { fetch })
  assert.ok(calls[0].url.endsWith('?ref=dev'))
})

test('한글이 든 UTF-8 base64를 깨지지 않게 디코드한다', async () => {
  const rows = [{ id: '1', name: '백준 1000 A+B', group: '새 그룹 2', tags: ['수학', '구현'] }]
  const { fetch } = stub(contentsResponse(rows))
  const { problems, sha } = await fetchProblems(CONFIG, { fetch })
  assert.deepEqual(problems, rows)
  assert.equal(sha, 'abc123')
})

test('401 → 토큰 안내', async () => {
  const { fetch } = stub({ ok: false, status: 401, json: async () => ({}) })
  await assert.rejects(() => fetchProblems(CONFIG, { fetch }), (e) => {
    assert.ok(e instanceof DataRepoError)
    assert.equal(e.code, 'UNAUTHORIZED')
    assert.match(e.message, /토큰/)
    return true
  })
})

test('403 → 권한 안내', async () => {
  const { fetch } = stub({ ok: false, status: 403, json: async () => ({}) })
  await assert.rejects(() => fetchProblems(CONFIG, { fetch }), (e) => e.code === 'FORBIDDEN')
})

test('404 → 리포/파일 이름을 담은 안내', async () => {
  const { fetch } = stub({ ok: false, status: 404, json: async () => ({}) })
  await assert.rejects(() => fetchProblems(CONFIG, { fetch }), (e) => {
    assert.equal(e.code, 'NOT_FOUND')
    assert.match(e.message, /cplog-data/)
    return true
  })
})

test('그 외 오류는 상태 코드를 노출한다', async () => {
  const { fetch } = stub({ ok: false, status: 500, json: async () => ({}) })
  await assert.rejects(() => fetchProblems(CONFIG, { fetch }), (e) => e.code === 'HTTP' && /500/.test(e.message))
})

test('네트워크 예외를 DataRepoError로 감싼다', async () => {
  const fetch = async () => {
    throw new Error('getaddrinfo ENOTFOUND')
  }
  await assert.rejects(() => fetchProblems(CONFIG, { fetch }), (e) => e.code === 'NETWORK')
})

test('JSON이 깨졌거나 배열이 아니면 PARSE 오류', async () => {
  const broken = {
    ok: true,
    status: 200,
    json: async () => ({ sha: 'x', content: Buffer.from('{nope', 'utf8').toString('base64') }),
  }
  await assert.rejects(() => fetchProblems(CONFIG, { fetch: stub(broken).fetch }), (e) => e.code === 'PARSE')
  await assert.rejects(
    () => fetchProblems(CONFIG, { fetch: stub(contentsResponse({ not: 'an array' })).fetch }),
    (e) => e.code === 'PARSE',
  )
})

test('설정이 비면 요청을 보내지 않고 안내한다', async () => {
  const { fetch, calls } = stub(contentsResponse([]))
  await assert.rejects(() => fetchProblems({ ...CONFIG, pat: '' }, { fetch }), (e) => e.code === 'NO_TOKEN')
  await assert.rejects(() => fetchProblems({ ...CONFIG, username: '' }, { fetch }), (e) => e.code === 'NOT_CONFIGURED')
  assert.equal(calls.length, 0, '설정이 없으면 네트워크를 타지 않아야 한다')
})
