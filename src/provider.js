const vscode = require('vscode')
const { buildTree, isReviewDue } = require('./tree')

// 트리 노드 종류: 그룹 섹션 / 문제 / 오류 안내
class GroupItem extends vscode.TreeItem {
  constructor(section) {
    super(section.name, vscode.TreeItemCollapsibleState.Expanded)
    this.section = section
    this.description = `${section.done}/${section.total} 해결`
    this.contextValue = 'cplogGroup'
    this.iconPath = new vscode.ThemeIcon('folder')
  }
}

class ProblemItem extends vscode.TreeItem {
  constructor(problem, now) {
    super(problem.name, vscode.TreeItemCollapsibleState.None)
    this.problem = problem
    this.contextValue = 'cplogProblem'
    this.description = [problem.platform, problem.difficulty].filter(Boolean).join(' · ')

    const due = isReviewDue(problem, now)
    if (problem.status === 'done') {
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    } else if (due) {
      this.iconPath = new vscode.ThemeIcon('bell-dot', new vscode.ThemeColor('charts.yellow'))
    } else {
      this.iconPath = new vscode.ThemeIcon('circle-outline')
    }

    const md = new vscode.MarkdownString()
    md.appendMarkdown(`**${escapeMd(problem.name)}**\n\n`)
    const meta = []
    if (problem.platform) meta.push(problem.platform)
    if (problem.difficulty) meta.push(`난이도 ${problem.difficulty}`)
    meta.push(problem.status === 'done' ? '해결' : '미해결')
    if (problem.group) meta.push(`문제집: ${problem.group}`)
    md.appendMarkdown(`${meta.map(escapeMd).join(' · ')}\n\n`)
    if (problem.tags.length) md.appendMarkdown(`태그: ${problem.tags.map(escapeMd).join(', ')}\n\n`)
    if (due) md.appendMarkdown(`⏰ 복습 예정일이 지났습니다\n\n`)
    if (problem.url) md.appendMarkdown(`[문제 열기](${problem.url})`)
    this.tooltip = md

    // URL이 없는 문제(직접 입력한 텍스트)는 클릭해도 열 게 없다
    if (problem.url) {
      this.command = { command: 'cplog.openProblem', title: '문제 열기', arguments: [this] }
    }
  }
}

class MessageItem extends vscode.TreeItem {
  constructor(label, { icon = 'warning', command, tooltip } = {}) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = new vscode.ThemeIcon(icon)
    this.contextValue = 'cplogMessage'
    if (tooltip) this.tooltip = tooltip
    if (command) this.command = { command, title: label }
  }
}

const escapeMd = (s) => String(s).replace(/([\\`*_[\]])/g, '\\$1')

/**
 * 상태(state)를 넘겨받아 트리를 그린다. 데이터 로딩 자체는 extension.js가 담당한다
 * — 프로바이더는 "현재 상태를 어떻게 보여줄지"만 안다.
 */
class ToSolveProvider {
  constructor(getState) {
    this.getState = getState
    this._onDidChangeTreeData = new vscode.EventEmitter()
    this.onDidChangeTreeData = this._onDidChangeTreeData.event
  }

  refresh() {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element) {
    return element
  }

  getChildren(element) {
    const state = this.getState()
    const now = Date.now()

    if (element instanceof GroupItem) {
      return element.section.rows.map((p) => new ProblemItem(p, now))
    }
    if (element) return []

    // 설정 전에는 빈 배열을 돌려줘 viewsWelcome(초기 설정 버튼)이 뜨게 한다
    if (!state.configured) return []

    const tree = buildTree(state.problems, { showDone: state.showDone, now })
    const items = []

    // 오류는 목록을 지우지 않고 맨 위에 한 줄로 알린다 (캐시된 목록은 계속 보여준다)
    if (state.error) {
      items.push(
        new MessageItem(state.error.message, {
          icon: 'error',
          tooltip: state.error.message,
          command: 'cplog.refresh',
        }),
      )
    }

    if (tree.flat) {
      items.push(...tree.sections[0].rows.map((p) => new ProblemItem(p, now)))
    } else {
      items.push(...tree.sections.map((s) => new GroupItem(s)))
    }

    if (!items.length) {
      items.push(
        state.showDone
          ? new MessageItem('등록된 문제가 없습니다', { icon: 'info' })
          : new MessageItem('풀어야 할 문제가 없습니다', { icon: 'check-all', tooltip: '해결한 문제를 보려면 목록 상단의 눈 아이콘을 누르세요' }),
      )
    }
    return items
  }
}

module.exports = { ToSolveProvider, GroupItem, ProblemItem, MessageItem }
