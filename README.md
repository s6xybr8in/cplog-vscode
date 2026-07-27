# CP-Log To Solve (VS Code)

[CP-Log](https://github.com/s6xybr8in/cplog)에 등록한 **풀어야 할 문제 목록을 VS Code 사이드바에** 띄웁니다. 코딩하던 창을 떠나지 않고 목록을 확인하고, 클릭해서 문제 페이지로 바로 넘어갈 수 있습니다.

**읽기 전용입니다.** 상태 변경·문제 추가는 CP-Log 앱에서 합니다 (이유는 아래 [왜 읽기 전용인가](#왜-읽기-전용인가) 참고).

## 이렇게 보입니다

```
CP-LOG / TO SOLVE
│
├─ 📁 그래프                    0/3 해결
│    ○ CF 1774F2                Codeforces · 2700
│    🔔 ABC269 H                 AtCoder
│    ○ BOJ 1854                 BOJ
│
├─ 📁 DP 연습                   7/9 해결
│    ○ DP X                     AtCoder
│    ○ ABC222 D                 AtCoder
│
└─ 📁 그룹 없음                  0/2 해결
     ○ ABC279 E                 AtCoder
     ○ CF 1249B2                Codeforces · 1300

상태바:  ☰ To Solve 7   🔔 복습 1
```

- `○` 미해결 · `🔔` 복습 예정일이 지난 문제(노랑) · `✓` 해결(초록, 기본으로는 숨김)
- 그룹 진행도는 **숨긴 해결 문제까지 포함**해 셉니다 — 위 `DP 연습 7/9`는 보이는 행이 2개여도 분모가 9입니다
- **전부 해결한 그룹은 목록에서 사라집니다** (해결한 문제 표시를 켜면 다시 나옵니다)
- 문제에 마우스를 올리면 플랫폼·난이도·상태·문제집·태그가 툴팁으로 뜹니다
- 이름 있는 그룹이 하나도 없으면 그룹 헤더 없이 평면 목록으로 보여줍니다

## 기능

- **앱과 같은 정렬 순서** — 미해결이 위, 같은 상태 안에서는 최신 등록순. 웹에서 보던 순서 그대로라 눈이 헷갈리지 않습니다
- **문제 클릭 → 브라우저에서 바로 열기**
- **우클릭 → 풀이 파일 만들기** — 문제 이름으로 파일을 만들고 바로 엽니다 (공백은 `_`, 기본 `.cpp`. 확장자·폴더는 설정으로 바꿉니다)
- **자동 새로고침** — 기본 10분, 끌 수도 있습니다
- **시작하자마자 목록이 보입니다** — 마지막에 불러온 목록을 캐시해두므로, VS Code를 켜고 네트워크 응답을 기다릴 필요가 없습니다
- **오류가 나도 목록이 사라지지 않습니다** — 캐시된 목록을 그대로 두고 맨 위에 오류 한 줄만 추가합니다

## 요구 사항

- **VS Code 1.85.0 이상**
- CP-Log 앱에서 **데이터 저장소 동기화가 켜져 있을 것** — 앱이 `problems.json`을 데이터 리포에 올려두지 않으면 익스텐션이 읽을 게 없습니다
- 데이터 리포를 읽을 수 있는 GitHub 토큰 (아래 [토큰](#토큰) 참고)

런타임 의존성은 0개입니다 — VS Code가 번들한 Node의 전역 `fetch`만 쓰므로 따로 설치할 것이 없습니다.

## 설치

아직 마켓플레이스에 올리지 않았습니다. `.vsix`로 설치합니다.

[Releases](https://github.com/s6xybr8in/cplog-vscode/releases/latest)에서 `cplog-vscode-0.2.0.vsix`를 받아서:

```bash
code --install-extension cplog-vscode-0.2.0.vsix
```

소스에서 직접 빌드하려면:

```bash
npm install
npm run package          # cplog-vscode-0.2.0.vsix 생성
code --install-extension cplog-vscode-0.2.0.vsix
```

## 설정

설치하면 액티비티 바에 CP-Log 아이콘이 생깁니다. 눌러서 **[초기 설정]** 버튼을 클릭하거나, 명령 팔레트(`Ctrl+Shift+P`)에서 **CP-Log: 초기 설정**을 실행하면 사용자명 → 데이터 리포 → 토큰 순으로 물어봅니다. 각 단계는 `Esc`로 취소할 수 있습니다.

데이터 리포 이름은 앱 설정의 **"데이터 저장소 동기화"에 쓰는 리포와 같아야** 합니다 (기본값 `cplog-data`).

### 토큰

익스텐션은 읽기만 하므로 **Contents: Read-only 파인그레인드 PAT**을 따로 발급해 쓰세요. 앱에서 쓰는 읽기/쓰기 토큰을 재사용하지 마세요 — 익스텐션에 쓰기 권한을 줄 이유가 없습니다.

발급 절차:

1. GitHub → [Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/personal-access-tokens)
2. **Generate new token**
3. **Repository access** → *Only select repositories* → 데이터 리포(`cplog-data`)만 선택
4. **Permissions** → *Repository permissions* → **Contents: Read-only**
5. 생성된 토큰을 복사해 초기 설정 3단계에 붙여넣기

토큰은 VS Code **SecretStorage**에 저장됩니다 — `settings.json`에 들어가지 않습니다 (커밋되거나 Settings Sync로 새어나갈 수 있으므로). 나중에 토큰만 바꾸려면 **CP-Log: GitHub 토큰 설정**을 실행하고, 빈 값을 넣으면 삭제됩니다.

### 설정 항목

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `cplog.username` | `""` | GitHub 사용자명 |
| `cplog.dataRepo` | `"cplog-data"` | `problems.json`이 있는 데이터 리포 |
| `cplog.dataBranch` | `"main"` | 브랜치 |
| `cplog.showDone` | `false` | 해결한 문제도 표시 |
| `cplog.refreshMinutes` | `10` | 자동 새로고침 주기(분), `0`이면 수동만 |
| `cplog.fileExtension` | `"cpp"` | 풀이 파일 확장자 (`cpp`·`.cpp` 둘 다 됨) |
| `cplog.fileDirectory` | `""` | 풀이 파일을 만들 폴더 (워크스페이스 루트 기준 상대 경로) |

사용자명·데이터 리포·브랜치를 바꾸면 즉시 다시 불러옵니다. 새로고침 주기를 바꾸면 타이머가 새 주기로 다시 걸립니다.

## 풀이 파일 만들기

문제를 **우클릭 → CP-Log: 문제 파일 만들기**를 누르면 문제 이름으로 파일을 만들고 에디터에서 엽니다. **공백은 밑줄(`_`)로 바뀝니다** — 셸에서 따옴표 없이 컴파일·실행할 수 있게.

```
CF 1850A          →  <워크스페이스>/CF_1850A.cpp
BOJ 1000: A+B     →  <워크스페이스>/BOJ_1000_A+B.cpp
```

- 확장자는 `cplog.fileExtension`(기본 `cpp`), 위치는 `cplog.fileDirectory`(기본: 워크스페이스 루트)로 정합니다. 폴더가 없으면 만듭니다
- **같은 이름의 파일이 이미 있으면 덮어쓰지 않고 열기만 합니다** — 풀던 코드가 날아가지 않습니다
- 파일명에 쓸 수 없는 글자(`: / \ * ? " < > |`)도 밑줄이 되고, 끝의 점·공백과 Windows 예약 장치 이름(`CON` 등)도 정리합니다
- 만들어지는 파일은 **빈 파일**입니다. 템플릿을 쓰려면 VS Code 스니펫이나 파일 템플릿 익스텐션을 함께 쓰세요
- 폴더를 열지 않은 창에서는 만들 위치가 없어 오류를 알립니다

## 명령

| 명령 | 어디서 |
| --- | --- |
| **CP-Log: 새로고침** | 목록 상단 ↻ 아이콘, 명령 팔레트 |
| **CP-Log: 해결한 문제 표시 전환** | 목록 상단 👁 아이콘, 명령 팔레트 |
| **CP-Log: 초기 설정** | 목록 `⋯` 메뉴, 명령 팔레트 |
| **CP-Log: GitHub 토큰 설정** | 명령 팔레트 |
| **CP-Log: 문제 열기** | 문제 클릭 또는 우클릭 |
| **CP-Log: 문제 파일 만들기** | 문제 우클릭 |

상태바의 `☰ To Solve n`을 누르면 목록으로 이동합니다.

## 문제 해결

오류가 나도 **마지막으로 불러온 목록은 지우지 않습니다.** 목록 맨 위에 오류 한 줄이 추가될 뿐이고, 그 줄을 클릭하면 다시 시도합니다.

| 증상 | 원인과 해결 |
| --- | --- |
| `problems.json을 찾을 수 없습니다` | 리포 이름 오타이거나, **앱에서 데이터 저장소 동기화를 켜지 않아** 원격에 파일이 아직 없는 경우입니다. GitHub API가 둘을 구분해주지 않으므로 양쪽 다 확인하세요. |
| `GitHub 토큰이 유효하지 않습니다` | 토큰이 만료·폐기됐습니다. **CP-Log: GitHub 토큰 설정**으로 다시 넣으세요. |
| `접근이 거부되었습니다` | 토큰에 해당 리포의 **Contents 읽기 권한**이 없습니다. 파인그레인드 토큰이라면 Repository access에 그 리포가 포함됐는지도 확인하세요. |
| `problems.json을 읽을 수 없습니다` | 파일이 깨졌거나 배열이 아닙니다. 앱에서 다시 동기화해보세요. |
| 목록이 비어 있고 오류도 없음 | 풀어야 할 문제가 없는 상태입니다. 👁 아이콘으로 해결한 문제를 켜서 확인해보세요. |
| 🔔 표시가 안 보임 | 복습 대상이 **해결한 문제**라 숨겨졌을 수 있습니다. 복습 개수는 상태와 무관하게 세므로 상태바에는 잡히지만, 목록에서 보려면 👁을 켜야 합니다. |

## CP-Log가 정의하는 데이터 계약

이 익스텐션은 **CP-Log 앱이 만든 파일을 읽기만** 합니다. 스키마의 주인은 앱이며, 앱이 바꾸면 여기도 함께 고쳐야 합니다.

데이터 리포 루트의 `problems.json` = 문제 배열 통째로 (`JSON.stringify(problems, null, 2)`).

```js
{
  id, name, url,
  platform,        // Codeforces | AtCoder | BOJ | USACO | JUNGOL | Other
  difficulty,      // 문자열, 주로 CF 레이팅. 빈 값 가능
  tags: [],
  group: '',       // 빈 문자열 = 그룹 없음
  status,          // 'todo' | 'done'  (구버전 'in_progress'는 todo로 취급)
  createdAt,
  reviewAt,        // number | null — 지났으면 복습 대상
  solvedAt         // 선택
}
```

정렬 규칙도 앱(`ProblemTable`)과 맞춥니다.

- 행: 미해결 → 해결 순, 같은 상태 안에서는 최신 등록순
- 그룹: 이름 자연 정렬(`새 그룹 2` < `새 그룹 10`), **`그룹 없음`은 맨 뒤**
- 이름 있는 그룹이 없으면 섹션 없이 평면 목록

파싱은 관대합니다 — 모르는 필드는 버리고, 빠진 필드는 기본값으로 채우며, 깨진 데이터에도 목록이 통째로 죽지 않습니다.

## 왜 읽기 전용인가

CP-Log 앱의 동기화 엔진은 `problems.json`을 **병합 없이 배열 통째로** PUT하고, 충돌(409)이 나면 최신 sha를 받아 **로컬 배열을 그대로 다시 올립니다** (노트·스니펫만 `updatedAt`을 비교합니다).

즉 익스텐션에서 상태를 바꿔도, 앱이 그 변경을 pull하기 전에 뭔가를 수정해 push하면 **조용히 사라집니다**. 쓰기를 지원하려면 앱 쪽 push에 항목 단위 병합을 먼저 넣어야 합니다.

## 개발

```bash
npm test                 # VS Code 없이 도는 단위 테스트 (아래 1·2단계)
npm run test:integration # 실제 VS Code를 내려받아 확장 호스트에서 검증 (3단계)
```

테스트는 세 겹입니다.

1. **순수 로직** (`test/tree.test.mjs`, `test/fileName.test.mjs`) — 정렬·그룹·필터·방어적 파싱, 파일명 정리
2. **확장 실행** (`test/extension.test.mjs`, `test/dataRepo.test.mjs`) — `vscode` 모듈을 스텁해서 `activate()`와 트리 프로바이더를 실제로 돌린다. VS Code를 띄우지 않고도 API 오용·명령 등록·시크릿 저장·캐시 동작을 잡는다
3. **확장 호스트** (`test/integration/`) — 실제 VS Code에서 매니페스트가 로드되는지까지 확인

`F5`로 확장 개발 호스트를 띄워 수동 확인할 수 있습니다.

> Windows에서 3단계가 `Code is currently being updated`로 실패하면, VS Code 업데이트 설치 프로그램(`CodeSetup-*.exe`)이 떠 있는 것입니다. 전역 뮤텍스를 잡고 있어 테스트용 VS Code도 뜨지 못하니, VS Code를 모두 닫아 업데이트를 끝낸 뒤 다시 실행하세요.
