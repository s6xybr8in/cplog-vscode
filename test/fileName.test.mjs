// 순수 로직 — VS Code 없이 돈다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildFileName, sanitizeBaseName, normalizeExtension, splitDirectory } = require('../src/fileName.js')

test('공백은 밑줄로 바꾸고 기본 확장자는 cpp', () => {
  assert.equal(buildFileName('CF 1850A'), 'CF_1850A.cpp')
  assert.equal(buildFileName('기타 문제'), '기타_문제.cpp')
  assert.equal(buildFileName('OneWord'), 'OneWord.cpp', '공백이 없으면 그대로')
})

test('연속 공백은 밑줄 하나로 접는다', () => {
  assert.equal(sanitizeBaseName('a   b\tc'), 'a_b_c')
})

test('파일명에 못 쓰는 글자도 밑줄이 된다', () => {
  assert.equal(sanitizeBaseName('BOJ 1000: A+B'), 'BOJ_1000_A+B')
  assert.equal(sanitizeBaseName('a/b\\c*d?e"f<g>h|i'), 'a_b_c_d_e_f_g_h_i')
})

test('이름 끝의 점·공백은 밑줄로 남기지 않고 없앤다 (Windows가 조용히 잘라낸다)', () => {
  assert.equal(sanitizeBaseName('Problem A.  '), 'Problem_A')
  assert.equal(sanitizeBaseName('...'), 'problem')
})

test('빈 이름이나 예약 장치 이름에도 만들 수 있는 파일명을 돌려준다', () => {
  assert.equal(sanitizeBaseName(''), 'problem')
  assert.equal(sanitizeBaseName('   '), 'problem')
  assert.equal(sanitizeBaseName(null), 'problem')
  assert.equal(sanitizeBaseName('CON'), '_CON')
  assert.equal(sanitizeBaseName('nul'), '_nul')
  assert.equal(sanitizeBaseName('com1'), '_com1')
})

test('아주 긴 이름은 잘라 경로 길이 제한을 피한다', () => {
  const base = sanitizeBaseName('가'.repeat(300))
  assert.equal(base.length, 80)
})

test('확장자는 점을 붙여도 안 붙여도 되고, 비면 cpp로 떨어진다', () => {
  assert.equal(normalizeExtension('py'), 'py')
  assert.equal(normalizeExtension('.py'), 'py')
  assert.equal(normalizeExtension('  .rs  '), 'rs')
  assert.equal(normalizeExtension(''), 'cpp')
  assert.equal(normalizeExtension('   '), 'cpp')
  assert.equal(normalizeExtension(undefined), 'cpp')
  assert.equal(normalizeExtension('c/pp'), 'cpp', '경로 구분자는 확장자에 못 들어간다')
})

test('폴더 설정은 세그먼트로 쪼개고 워크스페이스 밖으로 나가는 ..는 버린다', () => {
  assert.deepEqual(splitDirectory('solutions/cf'), ['solutions', 'cf'])
  assert.deepEqual(splitDirectory('solutions\\cf'), ['solutions', 'cf'])
  assert.deepEqual(splitDirectory('/solutions//cf/'), ['solutions', 'cf'])
  assert.deepEqual(splitDirectory('../../etc'), ['etc'])
  assert.deepEqual(splitDirectory('./sol'), ['sol'])
  assert.deepEqual(splitDirectory(''), [])
  assert.deepEqual(splitDirectory(undefined), [])
})
