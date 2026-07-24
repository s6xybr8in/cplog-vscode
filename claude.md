# 프로젝트 명: CP-Log To Solve (VS Code 익스텐션)

## 📌 역할 설정
너는 VS Code 익스텐션 개발 전문가야. 순수 JavaScript(CommonJS)와 VS Code Extension API만으로, 빌드 단계 없이 동작하는 가벼운 사이드바 익스텐션을 만들고 유지보수해줘. TypeScript·번들러·런타임 의존성은 추가하지 않는다.

## 🚀 핵심 목표
[CP-Log](https://github.com/s6xybr8in/cplog) 웹앱에 등록한 **풀어야 할 문제(To Solve) 목록을 VS Code 사이드바에** 띄운다. 문제를 푸는 창(VS Code)을 벗어나지 않고 목록 확인 → 문제 페이지로 이동까지 끝내는 것이 전부다.

---

# 📈 프로젝트 진행 상황 (2026-07-24 기준)

## 구현 형태 (확정된 결정)
- **algonote와 별도 리포** (사용자 결정, `C:\Users\KwanHo\Desktop\04_Project\cplog-vscode` — algonote와 형제 폴더). 릴리스 주기·이슈가 웹앱과 분리되고, 익스텐션 devDependency(`@vscode/vsce` 등)가 웹앱의 `npm ci`/GitHub Pages 배포에 섞이지 않는다.
- **읽기 전용** (사용자 결정, 이유는 아래 기술 제약 참고).
- **순수 JS(CommonJS)** — TypeScript·번들러 없이 VS Code가 `extension.js`를 그대로 로드한다. algonote가 plain JS라 톤을 맞추고 빌드 단계를 없앴다.
- **런타임 의존성 0개** — Node 20+ 전역 `fetch` 사용. devDependency는 `@vscode/vsce`(패키징) / `@vscode/test-electron` + `mocha`(통합 테스트)뿐.
- `engines.vscode ^1.85.0`, `activationEvents: ["onStartupFinished"]`.

## 📂 파일 구조
```
cplog-vscode/
  extension.js        # activate() — 상태 관리·명령 등록·상태바·자동 새로고침 타이머
  src/dataRepo.js     # GitHub Contents API 클라이언트 (fetch → base64 디코드 → JSON.parse)
  src/tree.js         # 순수 함수: 문제 배열 → 섹션/행 구조 (vscode 모듈 미참조 = 단위 테스트 대상)
  src/provider.js     # TreeDataProvider — tree.js 결과를 TreeItem으로 변환
  media/cplog.svg     # 액티비티 바 아이콘 (algonote build/icon.png와 같은 로고, 단색 SVG)
  test/               # 단위(vscode 스텁) + 통합(@vscode/test-electron)
  README.md           # 설치법 + 데이터 계약 (사용자용)
  PLAN.md             # 최초 설계 계획서 (.vscodeignore로 패키지에서 제외)
```

**책임 분리**: 데이터 로딩은 `extension.js`, "현재 상태를 어떻게 보여줄지"만 `provider.js`. `provider`는 `getState` 콜백을 받아 렌더만 한다.

## ✅ 완료된 기능 (v0.1.0, 2026-07-24)
1. **그룹(문제집)별 접이식 트리** — 그룹 노드 label=그룹 이름, description=`3/8 해결`(진행도는 **숨긴 done까지 포함**해 계산), 기본 펼침. 이름 있는 그룹이 하나도 없으면 섹션 없이 평면 목록. **전부 해결된 그룹은 목록에서 사라진다**(showDone이면 다시 보임).
2. **문제 노드** — label=`name`, description=`Codeforces · 1600`, tooltip=MarkdownString(플랫폼·난이도·상태·문제집·태그·복습 경고·문제 열기 링크, `escapeMd`로 마크다운 이스케이프). 아이콘: done `check`(charts.green) / **복습 기한 도래** `bell-dot`(charts.yellow) / todo `circle-outline`. **URL 없는 문제는 `command`를 아예 붙이지 않는다**(클릭해도 열 게 없음).
3. **상태바** — `$(list-unordered) To Solve 12` + 복습 도래 시 `$(bell-dot) 복습 3`, 클릭 → `cplogToSolve.focus`. 툴팁에 미해결/해결/복습 대기 전부.
4. **GitHub 데이터 리포 읽기** (`src/dataRepo.js`) — `GET /repos/{username}/{dataRepo}/contents/problems.json?ref={branch}`, `Authorization: Bearer` + `Accept: application/vnd.github+json`. 오류 코드 매핑: 401 `UNAUTHORIZED` / 403 `FORBIDDEN` / 404 `NOT_FOUND`(리포 없음과 파일 없음을 구분할 수 없어 양쪽 다 안내) / 그 외 `HTTP` / fetch throw `NETWORK` / JSON 실패·배열 아님 `PARSE`. 정규화는 하지 않고 raw 배열 + sha를 그대로 넘긴다(정규화는 `tree.js` 책임).
5. **globalState 캐시** (`cplog.cache`) — 성공한 배열을 저장해 **시작 시 네트워크 응답 전에 목록이 바로 보인다**. 오류가 나도 캐시된 목록을 지우지 않고 트리 맨 위에 오류 한 줄(`MessageItem`, 클릭 시 재시도)만 추가한다.
6. **설정 마법사 + SecretStorage** — `cplog.setup`(사용자명 → 데이터 리포 → PAT 3단계, 각 단계 Esc로 취소 가능), `cplog.setToken`(PAT만 재설정, 빈 값 입력 시 삭제). **PAT은 `context.secrets`에만 저장**(키 `cplog.pat`).
7. **자동 새로고침** — `cplog.refreshMinutes`(기본 10분, `0`이면 수동만). `onDidChangeConfiguration`에서 주기 변경 시 타이머 재무장(`rearmTimer`), username/dataRepo/dataBranch 변경 시 즉시 refetch, showDone 변경 시 렌더만.
8. **빈 상태(`viewsWelcome`)** — 미설정(`!cplog.configured` 컨텍스트 키)이면 오류 대신 "[초기 설정]" 버튼. 설정 전에는 `getChildren()`이 **빈 배열**을 돌려줘야 viewsWelcome이 뜬다(빈 상태 메시지를 넣으면 안 됨).
9. **명령 6종** — `cplog.refresh`·`cplog.toggleShowDone`(뷰 타이틀 아이콘) / `cplog.setup`·`cplog.setToken`(팔레트) / `cplog.openProblem`·`cplog.copyProblemName`(노드 클릭·우클릭, `commandPalette`에서 `when: false`로 숨김).

## 🔗 상위 리포와의 데이터 계약 (★가장 중요)
**algonote(CP-Log 웹앱)가 스키마의 주인이고, 이 리포는 규칙을 코드로 복제해 갖고 있다.** import할 수 없으므로 앱이 바꾸면 **조용히 어긋난다** — algonote `claude.md`의 "🔗 연동 리포" 섹션에도 교차 참조가 걸려 있다.

데이터 리포 루트의 `problems.json` = 문제 **배열 통째로** (`JSON.stringify(problems, null, 2)`).

```js
{ id, name, url,
  platform,     // Codeforces | AtCoder | BOJ | USACO | JUNGOL | Other
  difficulty,   // 문자열(주로 CF 레이팅), 빈 값 가능
  tags: [], group: '',      // group 빈 문자열 = 그룹 없음
  status,       // 'todo' | 'done' — 구버전 'in_progress'는 todo로 취급
  createdAt, reviewAt, solvedAt }
```

정렬 규칙은 앱 `ProblemTable.jsx`와 **동일해야 한다**(순서가 다르면 혼란스럽다):
- 행: `todo → done`, 같은 상태 안에서는 `createdAt` **내림차순**(최신 등록순)
- 그룹 섹션: `localeCompare(undefined, { numeric: true })` 오름차순 → `새 그룹 2` < `새 그룹 10`
- `그룹 없음`(`UNGROUPED_KEY = '__cplog_ungrouped__'`) 섹션은 **맨 뒤**
- 복습 도래 판정: `reviewAt != null && now >= reviewAt` (경계 포함), **상태와 무관하게** 센다

## ⚠️ 반드시 지켜야 할 기술 제약 (검증으로 확인된 사실)
- **쓰기를 추가하지 말 것.** algonote `src/hooks/useGithubSync.js`의 push는 `problems.json`에 병합 로직이 **없다** — 409가 나면 최신 sha를 받아 **로컬 배열을 그대로 다시 PUT**한다(노트·스니펫만 `updatedAt` 비교). 익스텐션이 상태를 바꿔도 앱이 다음 push 때 조용히 덮어쓴다. 쓰기를 지원하려면 **앱 쪽 push에 항목 단위 병합을 먼저 넣어야 한다.**
- **`X-GitHub-Api-Version` 헤더를 추가하지 말 것** — 웹앱에선 CORS preflight 허용 목록에 없어 요청 자체가 실패한다(github/docs#24706). Node에선 통하지만 동작 차이가 없으므로 웹앱과 같은 형태를 유지한다.
- **base64 디코드는 `Buffer.from(..., 'base64').toString('utf8')`** — 웹앱의 `fromBase64`는 브라우저 `atob` 기반이라 재사용할 수 없다. GitHub Contents API는 base64에 줄바꿈을 섞어 주므로 `.replace(/\s/g, '')` 선행 필수. 문제 이름에 한글이 있어 UTF-8 디코드가 아니면 깨진다.
- **파싱은 관대하게** — `normalizeProblems`는 배열이 아니거나 필드가 빠지거나 모르는 필드가 와도 **절대 throw하지 않는다**. 앱이 스키마를 바꿔도 목록이 통째로 죽지 않게 하는 안전장치이므로, 엄격한 검증으로 바꾸지 말 것.
- **PAT을 `settings.json`에 넣지 말 것** — 커밋되거나 Settings Sync로 새어나간다. 반드시 `context.secrets`(SecretStorage). 읽기만 하므로 사용자에겐 **Contents: Read-only 파인그레인드 PAT**을 새로 발급하도록 안내한다(앱의 읽기/쓰기 토큰 재사용 금지).
- **`src/tree.js`는 `vscode` 모듈을 import하지 않는다** — 이 경계가 깨지면 VS Code 없이 도는 단위 테스트가 전부 무너진다.
- **전제**: 앱에서 데이터 리포 동기화가 **켜져 있어야** 한다. 꺼져 있으면 원격에 `problems.json`이 없어 404 → 목록이 빈다.

## 🧪 검증
```bash
npm test                 # 단위 — VS Code 불필요, 41건 통과 (2026-07-24 확인)
npm run test:integration # 통합 — 실제 VS Code 내려받아 확장 호스트에서 14건
npm run package          # cplog-vscode-0.1.0.vsix 생성
```
테스트는 세 겹이다.
1. **순수 로직** (`test/tree.test.mjs`) — 정렬·그룹·필터·방어적 파싱·복습 경계(`now === reviewAt`)
2. **확장 실행** (`test/extension.test.mjs`, `test/dataRepo.test.mjs`) — `test/vscodeStub.mjs`로 `vscode` 모듈을 스텁해 `activate()`를 실제로 돌린다. VS Code를 띄우지 않고 API 오용·명령 등록·시크릿 저장·캐시 동작을 잡는다. `fetch` 스텁으로 요청 URL·헤더(Bearer/Accept, **`X-GitHub-Api-Version` 부재**)·한글 base64 왕복·오류 매핑 검증
3. **확장 호스트** (`test/integration/index.js`) — 실제 VS Code에서 `activate()`가 노출한 `{_state, _provider, _statusBar, _refresh}` 내부 API에 상태를 주입해 네트워크 없이 트리·상태바 렌더 검증

`F5`로 확장 개발 호스트를 띄워 수동 확인 가능(`.vscode/launch.json`).

### 실데이터 대조 (2026-07-24)
실제 `s6xybr8in/cplog-data`(private)의 `problems.json`을 `buildTree`에 그대로 먹여 VS Code 없이 트리를 재현했고, 데이터 계약이 어긋나지 않음을 확인했다. 다음 세션에서 다시 대조할 기준선:

```
counts {"total":42,"todo":21,"done":21,"reviewDue":2}  flat:false
섹션 6: 업솔빙(0/3) · 자료구조(0/7) · asdf(0/1) · DP연습(7/9) · Knapsack(3/9) · 그룹 없음
숨겨진(전부 해결) 그룹 3: 좌표변환, Closet pairs, z_Done
정규화 42/42 (버린 항목 0) · URL 없는 문제 1건
```

- 실데이터 필드는 `name, url, platform, difficulty, tags, status, reviewAt, id, createdAt, group` — **`solvedAt`은 실제로 존재하지 않는다.** 관대한 파싱이 `null`로 채워 넘어간다(계약 문서의 필드 목록이 앱 코드 기준이라 실데이터보다 넓음).
- 그룹 정렬은 한글(업솔빙 < 자료구조) → 라틴(asdf < DP연습 < Knapsack) 순. `tree.js`가 예고한 ko-KR 로케일 동작 그대로다.
- **복습 도래 2건이 둘 다 `done`이고 전부 해결된 `z_Done` 그룹**이라 트리에는 안 뜨고 상태바에만 잡힌다. 노란 `bell-dot` 아이콘을 눈으로 보려면 `showDone`을 켜야 한다.

> **Windows 함정**: 3단계가 `Code is currently being updated`로 실패하면 VS Code 업데이트 설치 프로그램(`CodeSetup-*.exe`)이 떠 있는 것이다. 전역 뮤텍스를 잡고 있어 테스트용 VS Code도 뜨지 못한다 — VS Code를 모두 닫아 업데이트를 끝낸 뒤 재실행.

## 📦 배포 상태
- **원격 리포 공개 완료** (2026-07-24) — <https://github.com/s6xybr8in/cplog-vscode> (public, 기본 브랜치 `main`). `origin/main`에 3개 커밋 푸시됨. `package.json`의 `repository.url`과 실제 리포 주소가 일치한다.
- **v0.1.0 릴리스 완료** (2026-07-24) — <https://github.com/s6xybr8in/cplog-vscode/releases/tag/v0.1.0>에 `cplog-vscode-0.1.0.vsix` 첨부. 태그 `v0.1.0`. 다음 릴리스는 `package.json` 버전을 올리고 `npm run package` → `gh release create vX.Y.Z <vsix>`.
- **Marketplace 미퍼블리시** — publisher 계정이 필요해 `.vsix` 배포까지만. 설치는 `code --install-extension cplog-vscode-0.1.0.vsix`.
- **설치는 사용자 환경을 바꾸므로** 에이전트가 임의로 실행하지 말 것 — `.vsix` 생성까지만 하고 설치 여부는 물어본다.
- **`.vsix`에 들어가는 건 10개 파일뿐** — `extension.js`, `package.json`, `readme.md`, `LICENSE.txt`, `media/cplog.svg`, `src/*.js` 3개. `test/`·`claude.md`·`PLAN.md`·`.omc/`는 `.vscodeignore`로 제외된다.

## 🚧 다음 작업 / 범위 밖
**다음 작업 후보**
- 실데이터 UI 확인 — 데이터 계약은 위 "실데이터 대조"로 검증됐고, **남은 건 실제 화면**(F5 확장 개발 호스트에 읽기 전용 PAT을 물려 다크/라이트 스크린샷). PAT 발급이 필요해 에이전트가 대신 못 한다.
- README 보강 — 공개 리포가 됐으니 처음 보는 사람 기준으로 다듬기(스크린샷 자리 비어 있음)

**명시적 범위 밖**
- 상태 변경·문제 추가 등 **쓰기** (위 기술 제약 참고)
- Marketplace 퍼블리시
- 노트 열람·편집 (이 익스텐션은 To Solve 목록만 다룬다)
