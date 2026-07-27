const vscode = require('vscode')
const { ToSolveProvider, ProblemItem } = require('./src/provider')
const { fetchProblems } = require('./src/dataRepo')
const { buildTree } = require('./src/tree')
const { buildFileName, splitDirectory, DEFAULT_EXTENSION } = require('./src/fileName')

const SECRET_PAT = 'cplog.pat'
const CACHE_KEY = 'cplog.cache'

const config = () => vscode.workspace.getConfiguration('cplog')

// 네트워크 응답 전에도 목록이 바로 보이도록 마지막 성공분을 globalState에 캐시한다
const state = { problems: [], showDone: false, error: null, loading: false, configured: false }

function activate(context) {
  state.showDone = config().get('showDone', false)
  const cached = context.globalState.get(CACHE_KEY)
  if (cached && Array.isArray(cached.problems)) state.problems = cached.problems

  const provider = new ToSolveProvider(() => state)
  const view = vscode.window.createTreeView('cplogToSolve', { treeDataProvider: provider })
  context.subscriptions.push(view)

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  status.command = 'cplogToSolve.focus'
  context.subscriptions.push(status)

  const render = () => {
    provider.refresh()
    const { counts } = buildTree(state.problems, { showDone: state.showDone })
    const parts = [`$(list-unordered) To Solve ${counts.todo}`]
    if (counts.reviewDue) parts.push(`$(bell-dot) 복습 ${counts.reviewDue}`)
    status.text = parts.join(' ')
    status.tooltip = `CP-Log — 미해결 ${counts.todo} · 해결 ${counts.done}${counts.reviewDue ? ` · 복습 대기 ${counts.reviewDue}` : ''}`
    status.show()
    view.description = state.loading ? '불러오는 중…' : undefined
  }

  const readConfig = async () => ({
    username: (config().get('username', '') || '').trim(),
    dataRepo: (config().get('dataRepo', 'cplog-data') || '').trim(),
    dataBranch: (config().get('dataBranch', 'main') || 'main').trim(),
    pat: (await context.secrets.get(SECRET_PAT)) || '',
  })

  const refresh = async ({ silent = true } = {}) => {
    if (state.loading) return
    const cfg = await readConfig()
    // 설정 전에는 오류 대신 viewsWelcome(초기 설정 버튼)을 보여준다.
    // 아래 await 사이에 state.configured가 바뀔 수 있으므로(설정 마법사 완료 등)
    // 판단은 이번 cfg로 계산한 지역 변수로만 한다 — 공유 상태를 다시 읽으면
    // 토큰 없이 fetch로 들어가 엉뚱한 NO_TOKEN 오류가 남는다.
    const configured = !!(cfg.username && cfg.dataRepo && cfg.pat)
    state.configured = configured
    await vscode.commands.executeCommand('setContext', 'cplog.configured', configured)
    if (!configured) {
      state.error = null
      render()
      return
    }
    state.loading = true
    render()
    try {
      const { problems } = await fetchProblems(cfg)
      state.problems = problems
      state.error = null
      await context.globalState.update(CACHE_KEY, { problems, at: Date.now() })
    } catch (err) {
      state.error = { code: err.code || 'UNKNOWN', message: err.message }
      if (!silent) vscode.window.showErrorMessage(`CP-Log: ${err.message}`)
    } finally {
      state.loading = false
      render()
    }
  }

  // --- 명령 ---

  const register = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn))

  register('cplog.refresh', () => refresh({ silent: false }))

  register('cplog.openProblem', (item) => {
    const url = item instanceof ProblemItem ? item.problem.url : item?.problem?.url
    if (url) vscode.env.openExternal(vscode.Uri.parse(url))
  })

  const exists = async (uri) => {
    try {
      await vscode.workspace.fs.stat(uri)
      return true
    } catch {
      return false
    }
  }

  register('cplog.createProblemFile', async (item) => {
    const problem = item?.problem
    if (!problem) return
    const folder = vscode.workspace.workspaceFolders?.[0]
    if (!folder) {
      vscode.window.showErrorMessage('CP-Log: 파일을 만들 폴더가 없습니다. 먼저 작업 폴더를 여세요.')
      return
    }

    const segments = splitDirectory(config().get('fileDirectory', ''))
    const dir = segments.length ? vscode.Uri.joinPath(folder.uri, ...segments) : folder.uri
    const fileName = buildFileName(problem.name, config().get('fileExtension', DEFAULT_EXTENSION))
    const uri = vscode.Uri.joinPath(dir, fileName)

    try {
      // 이미 있으면 덮어쓰지 않고 그대로 연다 — 풀던 코드를 날려선 안 된다
      if (!(await exists(uri))) {
        if (segments.length) await vscode.workspace.fs.createDirectory(dir)
        await vscode.workspace.fs.writeFile(uri, new Uint8Array())
      }
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
    } catch (err) {
      vscode.window.showErrorMessage(`CP-Log: ${fileName}을(를) 만들지 못했습니다 — ${err.message}`)
    }
  })

  register('cplog.toggleShowDone', async () => {
    state.showDone = !state.showDone
    await config().update('showDone', state.showDone, vscode.ConfigurationTarget.Global)
    render()
  })

  register('cplog.setToken', async () => {
    const pat = await vscode.window.showInputBox({
      title: 'CP-Log — GitHub 토큰',
      prompt: '데이터 리포를 읽을 토큰. 읽기만 하므로 Contents: Read-only 권한이면 충분합니다.',
      password: true,
      ignoreFocusOut: true,
    })
    if (pat === undefined) return
    if (pat.trim()) await context.secrets.store(SECRET_PAT, pat.trim())
    else await context.secrets.delete(SECRET_PAT)
    await refresh({ silent: false })
  })

  register('cplog.setup', async () => {
    const current = await readConfig()
    const username = await vscode.window.showInputBox({
      title: 'CP-Log 설정 (1/3) — GitHub 사용자명',
      value: current.username,
      ignoreFocusOut: true,
    })
    if (username === undefined) return
    const dataRepo = await vscode.window.showInputBox({
      title: 'CP-Log 설정 (2/3) — 데이터 리포 이름',
      prompt: '앱 설정의 "데이터 저장소 동기화"에 쓰는 리포와 같아야 합니다.',
      value: current.dataRepo || 'cplog-data',
      ignoreFocusOut: true,
    })
    if (dataRepo === undefined) return
    await config().update('username', username.trim(), vscode.ConfigurationTarget.Global)
    await config().update('dataRepo', dataRepo.trim(), vscode.ConfigurationTarget.Global)

    const pat = await vscode.window.showInputBox({
      title: 'CP-Log 설정 (3/3) — GitHub 토큰',
      prompt: '읽기 전용이라 Contents: Read-only 파인그레인드 토큰이면 충분합니다.',
      password: true,
      ignoreFocusOut: true,
    })
    if (pat === undefined) return
    if (pat.trim()) await context.secrets.store(SECRET_PAT, pat.trim())
    await refresh({ silent: false })
  })

  // --- 자동 새로고침 ---

  let timer = null
  const rearmTimer = () => {
    if (timer) clearInterval(timer)
    timer = null
    const minutes = config().get('refreshMinutes', 10)
    if (minutes > 0) timer = setInterval(() => refresh(), minutes * 60 * 1000)
  }
  context.subscriptions.push({ dispose: () => timer && clearInterval(timer) })
  rearmTimer()

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('cplog')) return
      if (e.affectsConfiguration('cplog.refreshMinutes')) rearmTimer()
      if (e.affectsConfiguration('cplog.showDone')) state.showDone = config().get('showDone', false)
      if (
        e.affectsConfiguration('cplog.username') ||
        e.affectsConfiguration('cplog.dataRepo') ||
        e.affectsConfiguration('cplog.dataBranch')
      ) {
        refresh()
      } else {
        render()
      }
    }),
  )

  render()
  refresh()

  // 통합 테스트에서 내부 상태를 들여다보기 위한 최소 API
  return {
    _state: state,
    _provider: provider,
    _statusBar: status,
    _refresh: refresh,
  }
}

function deactivate() {}

module.exports = { activate, deactivate }
