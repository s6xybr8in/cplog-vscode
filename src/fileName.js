// 문제 이름 → 실제로 만들 수 있는 파일 경로.
//
// 순수 함수만 둔다 (vscode 모듈을 import하지 않음) — VS Code 없이 단위 테스트할 수 있다.
// 문제 이름은 사람이 웹앱에 자유롭게 입력한 값이라 파일명으로 쓸 수 없는 글자가 섞여 있다.

const DEFAULT_EXTENSION = 'cpp'

// 파일명에 못 쓰는 글자(제어문자 포함). POSIX에선 `/`만 문제지만 같은 리포를 Windows에서도
// 열 수 있으니 가장 좁은 규칙(Windows)에 맞춘다.
const ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g

// Windows 예약 장치 이름 — 확장자를 붙여도 만들 수 없다 (`CON.cpp` 불가)
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

// 경로 길이 제한에 걸리지 않도록 이름 부분만 잘라둔다
const MAX_BASE = 80

/** 문제 이름에서 확장자를 뺀 파일명을 만든다. 어떤 입력에도 빈 문자열을 돌려주지 않는다. */
function sanitizeBaseName(name) {
  let base = String(name ?? '')
    .replace(ILLEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (base.length > MAX_BASE) base = base.slice(0, MAX_BASE)
  // Windows는 이름 끝의 점·공백을 조용히 잘라내므로 미리 없앤다
  base = base.replace(/[. ]+$/, '')
  if (!base) return 'problem'
  // 남은 공백은 밑줄로 — 셸·컴파일 명령에서 따옴표 없이 다루기 좋다
  base = base.replace(/ /g, '_')
  return RESERVED.test(base) ? `_${base}` : base
}

/** 설정값을 확장자로 정규화한다. `cpp`·`.cpp` 둘 다 받고, 비면 기본값으로 떨어진다. */
function normalizeExtension(ext, fallback = DEFAULT_EXTENSION) {
  const normalized = String(ext ?? '')
    .trim()
    .replace(ILLEGAL, '')
    .replace(/^\.+|\.+$/g, '')
    .trim()
  return normalized || fallback
}

function buildFileName(name, ext) {
  return `${sanitizeBaseName(name)}.${normalizeExtension(ext)}`
}

/**
 * 설정의 상대 경로를 세그먼트 배열로 쪼갠다.
 * `..`는 버린다 — 설정 하나로 워크스페이스 밖에 파일을 흘리지 않게 한다.
 */
function splitDirectory(dir) {
  return String(dir ?? '')
    .split(/[\\/]+/)
    .map((seg) => seg.trim())
    .filter((seg) => seg && seg !== '.' && seg !== '..')
}

module.exports = { buildFileName, sanitizeBaseName, normalizeExtension, splitDirectory, DEFAULT_EXTENSION }
