# CP-Log To Solve (VS Code)

[CP-Log](https://github.com/s6xybr8in/cplog)에 등록한 **풀어야 할 문제 목록을 VS Code 사이드바에** 띄웁니다. 코딩하던 창을 떠나지 않고 목록을 확인하고, 클릭해서 문제 페이지로 바로 넘어갈 수 있습니다.

**읽기 전용입니다.** 상태 변경·문제 추가는 CP-Log 앱에서 합니다 (이유는 아래 [왜 읽기 전용인가](#왜-읽기-전용인가) 참고).

## 기능

- 문제집(그룹)별 접이식 목록 — 앱과 **같은 정렬 순서**
- 그룹 헤더에 진행도 (`3/8 해결`)
- 복습 예정일이 지난 문제는 🔔 아이콘으로 강조
- 상태바에 미해결 개수 / 복습 대기 개수
- 문제 클릭 → 브라우저에서 문제 열기, 우클릭 → 이름 복사
- 해결한 문제 표시 on/off, 주기적 자동 새로고침

## 설치

아직 마켓플레이스에 올리지 않았습니다. `.vsix`로 설치합니다.

[Releases](https://github.com/s6xybr8in/cplog-vscode/releases/latest)에서 `cplog-vscode-0.1.0.vsix`를 받아서:

```bash
code --install-extension cplog-vscode-0.1.0.vsix
```

소스에서 직접 빌드하려면:

```bash
npm install
npm run package          # cplog-vscode-0.1.0.vsix 생성
code --install-extension cplog-vscode-0.1.0.vsix
```

## 설정

명령 팔레트(`Ctrl+Shift+P`)에서 **CP-Log: 초기 설정**을 실행하면 사용자명 → 데이터 리포 → 토큰 순으로 물어봅니다.

**전제**: CP-Log 앱에서 **데이터 저장소 동기화가 켜져 있어야** 합니다. 앱이 `problems.json`을 데이터 리포에 올려두지 않으면 목록이 비어 있습니다.

### 토큰

익스텐션은 읽기만 하므로 **Contents: Read-only 파인그레인드 PAT**을 따로 발급해 쓰는 것을 권장합니다 (앱에서 쓰는 읽기/쓰기 토큰을 재사용하지 마세요).

토큰은 VS Code **SecretStorage**에 저장됩니다 — `settings.json`에 들어가지 않습니다 (커밋되거나 Settings Sync로 새어나갈 수 있으므로).

### 설정 항목

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `cplog.username` | `""` | GitHub 사용자명 |
| `cplog.dataRepo` | `"cplog-data"` | `problems.json`이 있는 데이터 리포 |
| `cplog.dataBranch` | `"main"` | 브랜치 |
| `cplog.showDone` | `false` | 해결한 문제도 표시 |
| `cplog.refreshMinutes` | `10` | 자동 새로고침 주기(분), `0`이면 수동만 |

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

1. **순수 로직** (`test/tree.test.mjs`) — 정렬·그룹·필터·방어적 파싱
2. **확장 실행** (`test/extension.test.mjs`, `test/dataRepo.test.mjs`) — `vscode` 모듈을 스텁해서 `activate()`와 트리 프로바이더를 실제로 돌린다. VS Code를 띄우지 않고도 API 오용·명령 등록·시크릿 저장·캐시 동작을 잡는다
3. **확장 호스트** (`test/integration/`) — 실제 VS Code에서 매니페스트가 로드되는지까지 확인

`F5`로 확장 개발 호스트를 띄워 수동 확인할 수 있습니다.

> Windows에서 3단계가 `Code is currently being updated`로 실패하면, VS Code 업데이트 설치 프로그램(`CodeSetup-*.exe`)이 떠 있는 것입니다. 전역 뮤텍스를 잡고 있어 테스트용 VS Code도 뜨지 못하니, VS Code를 모두 닫아 업데이트를 끝낸 뒤 다시 실행하세요.
