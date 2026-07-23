// 'vscode' 모듈은 확장 호스트 안에서만 존재한다. VS Code를 띄우지 않고 provider/extension을
// 실제로 실행해보기 위해, require('vscode')를 가로채 최소 구현을 돌려준다.
import Module from 'node:module'

export function installVscodeStub() {
  const state = {
    commands: new Map(),
    context: new Map(), // setContext로 설정된 키
    opened: [],
    clipboard: '',
    errors: [],
    inputQueue: [],
    settings: new Map(),
    configListeners: [],
  }

  class TreeItem {
    constructor(label, collapsibleState) {
      this.label = label
      this.collapsibleState = collapsibleState
    }
  }
  class ThemeIcon {
    constructor(id, color) {
      this.id = id
      this.color = color
    }
  }
  class ThemeColor {
    constructor(id) {
      this.id = id
    }
  }
  class MarkdownString {
    constructor() {
      this.value = ''
    }
    appendMarkdown(md) {
      this.value += md
      return this
    }
  }
  class EventEmitter {
    constructor() {
      this.listeners = []
      this.event = (fn) => {
        this.listeners.push(fn)
        return { dispose: () => {} }
      }
    }
    fire(...args) {
      this.listeners.forEach((l) => l(...args))
    }
  }

  const configFor = (section) => ({
    get: (key, dflt) => (state.settings.has(`${section}.${key}`) ? state.settings.get(`${section}.${key}`) : dflt),
    update: async (key, value) => {
      state.settings.set(`${section}.${key}`, value)
      const e = { affectsConfiguration: (s) => `${section}.${key}`.startsWith(s) }
      state.configListeners.forEach((fn) => fn(e))
    },
  })

  const vscode = {
    TreeItem,
    ThemeIcon,
    ThemeColor,
    MarkdownString,
    EventEmitter,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    ConfigurationTarget: { Global: 1 },
    Uri: { parse: (s) => ({ toString: () => s, _raw: s }) },
    window: {
      createTreeView: () => ({ description: undefined, dispose() {} }),
      createStatusBarItem: () => ({ text: '', tooltip: '', command: '', show() {}, dispose() {} }),
      showInputBox: async () => state.inputQueue.shift(),
      showErrorMessage: async (m) => state.errors.push(m),
      setStatusBarMessage: () => ({ dispose() {} }),
    },
    workspace: {
      getConfiguration: (section) => configFor(section),
      onDidChangeConfiguration: (fn) => {
        state.configListeners.push(fn)
        return { dispose: () => {} }
      },
    },
    commands: {
      registerCommand: (id, fn) => {
        state.commands.set(id, fn)
        return { dispose: () => {} }
      },
      executeCommand: async (id, ...args) => {
        if (id === 'setContext') {
          state.context.set(args[0], args[1])
          return
        }
        const fn = state.commands.get(id)
        if (!fn) throw new Error(`등록되지 않은 명령: ${id}`)
        return fn(...args)
      },
    },
    env: {
      openExternal: async (uri) => state.opened.push(uri._raw ?? String(uri)),
      clipboard: { writeText: async (t) => (state.clipboard = t) },
    },
    extensions: { getExtension: () => undefined },
  }

  const original = Module._resolveFilename
  Module._resolveFilename = function (request, ...rest) {
    if (request === 'vscode') return 'vscode'
    return original.call(this, request, ...rest)
  }
  Module._cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: vscode }

  return { vscode, state, restore: () => (Module._resolveFilename = original) }
}

// activate()에 넘길 최소 ExtensionContext
export function makeContext({ secrets = {}, globalState = {} } = {}) {
  const secretMap = new Map(Object.entries(secrets))
  const globalMap = new Map(Object.entries(globalState))
  return {
    subscriptions: [],
    secrets: {
      get: async (k) => secretMap.get(k),
      store: async (k, v) => secretMap.set(k, v),
      delete: async (k) => secretMap.delete(k),
    },
    globalState: {
      get: (k) => globalMap.get(k),
      update: async (k, v) => globalMap.set(k, v),
    },
    _secretMap: secretMap,
    _globalMap: globalMap,
  }
}
