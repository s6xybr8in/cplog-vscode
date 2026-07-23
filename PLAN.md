# CP-Log To Solve — VS Code 익스텐션 (별도 리포)

## Context

문제 푸는 작업은 VS Code에서 하는데, 풀어야 할 문제 목록은 CP-Log 앱을 따로 열어야 보인다. 코딩하던 창을 벗어나지 않고 To Solve 목록을 확인하고 문제 링크로 바로 넘어가게 하려는 것이다.

**algonote와 별도 리포로 만든다** (사용자 결정). 릴리스 주기·버전·이슈가 웹앱과 완전히 분리되고, 익스텐션 쪽 devDependency(`@vscode/vsce` 등)가 웹앱의 `npm ci`/Pages 배포에 섞이지 않는다.

- **위치**: `C:\Users\KwanHo\Desktop\04_Project\cplog-vscode` (algonote와 형제 폴더)
- **리포명**: `cplog-vscode`

**읽기 전용**으로 만든다 (사용자 결정). 안전 문제이기도 하다 — algonote의 `src/hooks/useGithubSync.js`(push)는 `problems.json`에 병합 로직이 없어서, 409가 나면 최신 sha로 **로컬 배열을 그대로 다시 PUT**한다 (노트·스니펫만 `updatedAt` 비교를 한다). 익스텐션이 쓰기를 하면 앱이 다음 push 때 조용히 덮어쓴다.

데이터는 **GitHub 데이터 리포(`cplog-data`)의 `problems.json`을 API로 직접** 읽는다 (사용자 결정). 앱의 localStorage는 브라우저/Electron 오리진에 갇혀 있어 접근할 수 없다. 이 방식이면 어느 폴더를 열어두든 목록이 보인다.

**전제**: 앱 설정에서 데이터 리포 동기화가 켜져 있어야 한다. 꺼져 있으면 원격에 `problems.json`이 없어 목록이 비어 보인다.

---

## 별도 리포이기 때문에 반드시 챙길 것

algonote 소스를 import할 수 없다. 아래 데이터 계약이 **이 리포 안에 문서로 남아야** 하고, 규칙을 코드로 다시 구현해야 한다.

### 데이터 계약 (algonote에서 확인한 사실 — 새 리포 `README.md`에 그대로 옮길 것)

`problems.json` = **배열 통째로** 직렬화 (`JSON.stringify(problems, null, 2)`), private 데이터 리포 루트에 위치.

```js
{ id, name, url, platform, difficulty, tags: [], group: '', status: 'todo'|'done',
  createdAt, reviewAt: number|null, solvedAt? }
```

- `platform` ∈ Codeforces / AtCoder / BOJ / USACO / JUNGOL / Other
- `group` 빈 문자열 = 그룹 없음
- `status`는 todo/done 2가지. 예전 데이터에 남은 `in_progress`는 **todo로 취급** (앱도 마운트 시 승격시킨다)
- `difficulty`는 문자열(주로 CF 레이팅). 빈 값 가능

### 정렬·그룹 규칙 (algonote `ProblemTable.jsx`와 동일하게)

순서가 앱과 다르면 혼란스러우므로 그대로 옮긴다.

- 행 정렬: todo → done 우선, 같은 상태 안에서는 `createdAt` **내림차순**
- 그룹 섹션: 이름 `localeCompare(undefined, { numeric: true })` 오름차순 → `새 그룹 2` < `새 그룹 10`
- `그룹 없음` 섹션은 **맨 뒤**
- 이름 있는 그룹이 하나도 없으면 섹션 없이 **평면 목록**

### 계약 드리프트 방지

algonote가 스키마를 바꾸면 익스텐션이 조용히 깨진다.

- 새 리포 `README.md`에 위 계약을 "algonote가 정의하는 계약" 섹션으로 명시
- 파싱은 **관대하게**: 모르는 필드는 무시, 없는 필드는 기본값. 배열이 아니거나 파싱 실패면 마지막 캐시를 유지하고 오류 항목만 표시
- 실행 단계 마지막에 algonote 쪽 `CLAUDE.md`에 한 줄 추가 — "`problems.json` 스키마 변경 시 `cplog-vscode` 리포도 함께 수정할 것" + 리포 링크

---

## 리포 구성

순수 JS(CommonJS). TypeScript·번들러 없이 VS Code가 `extension.js`를 그대로 로드한다 — algonote가 plain JS라 톤을 맞추고 빌드 단계를 없앤다.

```
cplog-vscode/
  package.json          # contributes, engines.vscode ^1.85.0, activationEvents: ["onStartupFinished"]
  extension.js          # activate() — 프로바이더·명령·상태바·자동 새로고침 타이머
  src/dataRepo.js       # GitHub API 클라이언트 (fetch → base64 디코드 → JSON.parse)
  src/tree.js           # 순수 함수: 문제 배열 → 섹션/행 구조 (테스트 대상)
  src/provider.js       # TreeDataProvider — tree.js 결과를 TreeItem으로 변환
  media/cplog.svg       # 액티비티 바 아이콘 (algonote build/icon.png와 같은 로고, 단색 SVG)
  test/                 # 단위 + 통합 테스트
  README.md             # 설치법 + 데이터 계약
  .gitignore            # node_modules, *.vsix, out
```

devDependency는 `@vscode/vsce`(패키징), `@vscode/test-electron` + `mocha`(통합 테스트)뿐. 런타임 의존성 0개 (Node 20+ 전역 `fetch` 사용).

## 기능

### 트리

- **그룹 노드**: label = 그룹 이름, description = `3/8 해결`, 기본 펼침
- **문제 노드**: label = `name`, description = `Codeforces · 1600`, tooltip = MarkdownString(URL·태그·그룹·등록일)
  - 아이콘: todo `circle-outline` / done `check`(`charts.green`) / **복습 기한 도래**(`reviewAt != null && Date.now() >= reviewAt`) `bell-dot`(`charts.yellow`)
  - 클릭 → `vscode.env.openExternal(url)`. url 없으면 명령 없이 정보만
- **상태바**: `$(list-unordered) To Solve 12`, 복습 기한 도래가 있으면 `· 복습 3` 덧붙임. 클릭 → 뷰 포커스

### 설정 (`cplog.*`)

| 키 | 기본값 |
| --- | --- |
| `cplog.username` | `""` |
| `cplog.dataRepo` | `"cplog-data"` (앱 기본값과 동일) |
| `cplog.dataBranch` | `"main"` |
| `cplog.showDone` | `false` |
| `cplog.refreshMinutes` | `10` (`0`이면 수동만) |

**PAT은 설정에 넣지 않는다** — `context.secrets`(SecretStorage)에 저장한다. settings.json은 커밋되거나 Settings Sync로 새어나갈 수 있다. 읽기만 하므로 **Contents: Read-only 파인그레인드 PAT**을 새로 발급하도록 README에 안내한다.

### 명령

`cplog.refresh`(뷰 타이틀) · `cplog.toggleShowDone`(뷰 타이틀) · `cplog.setToken`(`password: true` InputBox) · `cplog.setup`(username → dataRepo → PAT 마법사) · `cplog.openProblem`(노드 클릭) · `cplog.copyProblemName`(우클릭)

### GitHub 클라이언트

```
GET /repos/{username}/{dataRepo}/contents/problems.json?ref={branch}
Authorization: Bearer <pat>
Accept: application/vnd.github+json
```

- **`X-GitHub-Api-Version` 헤더를 넣지 않는다** — algonote에서 CORS로 금지된 헤더고, Node에서도 다르게 갈 이유가 없다
- 디코드: `Buffer.from(json.content, 'base64').toString('utf8')` (앱의 `fromBase64`는 브라우저 `atob` 기반이라 재사용 불가)
- 오류 매핑: 401 → "PAT이 유효하지 않습니다", 404 → "데이터 리포 '{repo}'를 찾을 수 없습니다", 그 외 상태 코드 노출
- **캐시**: 성공한 배열과 sha를 `globalState`에 저장 → 시작 시 네트워크 응답 전에 목록이 바로 보이고, 오프라인·오류 시 마지막 목록을 유지하며 오류는 항목으로만 표시

### 빈 상태 (`viewsWelcome`)

PAT 미설정 → 설정 마법사 버튼 / username 미설정 → 마법사 버튼 / 문제 0개 → "등록된 문제가 없습니다"

---

## 작업 순서

1. `cplog-vscode` 폴더 생성 + `git init` + `npm init` (로컬만)
2. `src/tree.js` 먼저 — 순수 로직 + 단위 테스트
3. `src/dataRepo.js` + 스텁 테스트
4. `extension.js` / `provider.js` / `package.json` contributes / 아이콘
5. `README.md` (설치법 + 데이터 계약)
6. 통합 테스트 → `.vsix` 패키징
7. **원격 리포 생성은 마지막에 별도로** — `gh repo create`는 되돌리기 번거로운 외부 동작이라, 공개/비공개를 확인받고 진행한다
8. algonote `CLAUDE.md`에 교차 참조 한 줄 추가

## 검증

1. **단위 테스트** (`node --test`, VS Code 불필요) — `test/tree.test.mjs`
   - 그룹 이름순(`새 그룹 2` < `새 그룹 10`), `그룹 없음` 맨 뒤, 이름 있는 그룹 없으면 평면 목록
   - 행 정렬 todo→done + 같은 상태 내 최신순
   - `showDone: false`일 때 done 제외 + 그룹 진행도(`3/8`)는 done 포함해 계산
   - `in_progress` 레거시 값이 todo로 취급되는지
   - 복습 기한 도래 경계(`now === reviewAt`)
   - 깨진 입력(배열 아님·필드 누락)에서 throw하지 않는지
2. **GitHub 클라이언트 테스트** — `fetch` 스텁으로 요청 URL·헤더(Bearer/Accept, `X-GitHub-Api-Version` **부재**) 검증, 한글 UTF-8 base64 왕복, 401/404 메시지 매핑
3. **통합 테스트** (`@vscode/test-electron`) — 실제 VS Code를 띄워 활성화 후, 스텁 데이터로 `getChildren()` 트리와 상태바 텍스트 검증
4. **실데이터 확인** — 실제 `cplog-data`에 PAT을 물려 목록이 앱과 같은 순서로 뜨는지 스크린샷(다크/라이트)
5. **설치는 사용자 환경을 바꾸므로** `.vsix` 생성까지만 하고, 설치 여부는 물어본다

## 범위 밖

- 상태 변경·문제 추가 등 쓰기 (병합 로직 부재로 손실 위험 — 하려면 algonote의 `problems.json` push에 항목 단위 병합을 먼저 넣어야 함)
- Marketplace 퍼블리시 (publisher 계정 필요) — 로컬 `.vsix`까지
- 노트 열람·편집
