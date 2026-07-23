// CP-Log 데이터 리포(private)에서 problems.json을 읽어온다. 읽기 전용.
//
// 쓰기를 하지 않는 이유: 웹앱의 동기화 엔진은 problems.json을 병합 없이 배열 통째로 PUT하고,
// 409가 나면 최신 sha로 로컬 배열을 그대로 다시 올린다. 익스텐션이 쓰면 앱이 조용히 덮어쓴다.

const API = 'https://api.github.com'

class DataRepoError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'DataRepoError'
    this.code = code
  }
}

function assertConfigured({ username, dataRepo, pat }) {
  if (!pat) throw new DataRepoError('NO_TOKEN', 'GitHub 토큰이 없습니다. "CP-Log: 초기 설정"을 실행해주세요.')
  if (!username || !dataRepo) {
    throw new DataRepoError('NOT_CONFIGURED', '사용자명과 데이터 리포를 설정해주세요. "CP-Log: 초기 설정"을 실행해주세요.')
  }
}

/**
 * problems.json을 가져온다.
 * @returns {Promise<{ problems: unknown[], sha: string }>} 정규화는 tree.js가 담당한다
 */
async function fetchProblems(config, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch
  assertConfigured(config)

  const { username, dataRepo, pat } = config
  const branch = (config.dataBranch || 'main').trim()
  const url = `${API}/repos/${encodeURIComponent(username.trim())}/${encodeURIComponent(dataRepo.trim())}/contents/problems.json?ref=${encodeURIComponent(branch)}`

  let res
  try {
    res = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        // X-GitHub-Api-Version은 넣지 않는다 — 웹앱에서 CORS preflight 때문에 금지된 헤더고,
        // 여기서도 굳이 다르게 갈 이유가 없다 (동작 차이 없음).
      },
    })
  } catch (err) {
    throw new DataRepoError('NETWORK', `네트워크 오류: ${err.message}`)
  }

  if (res.status === 401) throw new DataRepoError('UNAUTHORIZED', 'GitHub 토큰이 유효하지 않습니다. 토큰을 다시 설정해주세요.')
  if (res.status === 403) {
    throw new DataRepoError('FORBIDDEN', '접근이 거부되었습니다. 토큰에 이 리포의 Contents 읽기 권한이 있는지 확인해주세요.')
  }
  if (res.status === 404) {
    // 리포가 없는 경우와 파일만 없는 경우를 구분할 수 없다 — 양쪽을 다 안내한다
    throw new DataRepoError(
      'NOT_FOUND',
      `'${username}/${dataRepo}'에서 problems.json을 찾을 수 없습니다. 리포 이름과 앱의 데이터 리포 동기화 설정을 확인해주세요.`,
    )
  }
  if (!res.ok) throw new DataRepoError('HTTP', `목록을 가져오지 못했습니다 (HTTP ${res.status})`)

  const body = await res.json()
  // GitHub Contents API는 base64를 줄바꿈이 섞인 형태로 준다. 한글이 있으므로 UTF-8로 디코드한다
  // (웹앱의 fromBase64는 브라우저 atob 기반이라 여기서 재사용할 수 없다).
  const text = Buffer.from(String(body.content || '').replace(/\s/g, ''), 'base64').toString('utf8')

  let problems
  try {
    problems = JSON.parse(text)
  } catch {
    throw new DataRepoError('PARSE', 'problems.json을 읽을 수 없습니다 (JSON 형식 오류).')
  }
  if (!Array.isArray(problems)) throw new DataRepoError('PARSE', 'problems.json이 배열이 아닙니다.')

  return { problems, sha: body.sha || '' }
}

module.exports = { fetchProblems, DataRepoError }
