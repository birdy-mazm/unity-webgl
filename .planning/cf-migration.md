# CF Pages 이전 — 진행 기록

> 실행 브리프: [`cf_이전_실행브리프.md`](./cf_이전_실행브리프.md)
> 상태: **✅ 완료 — 골든패스 통과 (2026-08-15 19:03 KST)**
> 운영 URL: **https://mazm-unity-webgl.pages.dev** (GitHub Pages 병행 유지 = 롤백 경로)
> 최종 갱신: 2026-08-15

---

## 확정 정보

| 항목 | 값 |
|---|---|
| 레포 | `github.com/birdy-mazm/unity-webgl` (개인 계정 소유, public, 브랜치 `main`) |
| 빌드 출력 디렉터리 | `docs` |
| CF 계정 | `birdy@storymazm.com` (계정 1개, Account ID는 `wrangler whoami`로 확인) |
| R2 버킷명 | `webgl-assets` (location hint `apac`, Standard) — ✅ 생성됨 |
| Pages 프로젝트명 | `mazm-unity-webgl` — ✅ 생성됨 |
| **pages.dev URL** | **https://mazm-unity-webgl.pages.dev** |
| R2 바인딩 변수명 | `WEBGL_ASSETS` → `webgl-assets` — ✅ 설정됨 (Production) |
| Build command | `rm -f docs/Build/MazM_Studio_WebGL.data docs/Build/MazM_Studio_WebGL.wasm` |
| Build output directory | `docs` |

### 파일 크기 (실측 + R2 검증 완료)

| 파일 | 크기 | 서빙 경로 | R2 검증 |
|---|---|---|---|
| `MazM_Studio_WebGL.data` | 88,042,055 B (84.0 MiB) | R2 프록시 | ✅ 바이트 일치 |
| `MazM_Studio_WebGL.wasm` | 29,266,930 B (27.9 MiB) | R2 프록시 | ✅ 바이트 일치 |
| `MazM_Studio_WebGL.framework.js` | 414,939 B | CF Pages 정적 | — |
| `MazM_Studio_WebGL.loader.js` | 26,982 B | CF Pages 정적 | — |

브리프 §0의 크기 전제와 일치. 검증 방법: `wrangler r2 object get`으로 내려받아 `cmp`로 원본과 대조 (크기 일치 + 바이트 단위 동일).

---

## ⚠️ 브리프 대비 정정 사항

### 1. `wrangler r2 object put`에 `--remote` 필수 (wrangler 4.x)

브리프 §3①·§6의 명령은 **wrangler 4.x에서 실제 R2로 올라가지 않습니다.**
`--remote` 없이 실행하면 `Resource location: local` 로 miniflare **로컬 시뮬레이션**에 기록되고,
`Upload complete.` 메시지는 똑같이 출력되어 성공한 것처럼 보입니다. (실제로 이번에 한 번 걸렸음)

```bash
# ❌ 브리프 원문 — 로컬에만 기록됨
npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.data --file docs/Build/MazM_Studio_WebGL.data

# ✅ 올바른 명령
npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.data --file docs/Build/MazM_Studio_WebGL.data --remote
```

`r2 object get`도 동일하게 `--remote`가 필요합니다. `r2 bucket create`는 영향 없음(원격 실행).

부작용: `--remote` 없이 실행하면 프로젝트에 `.wrangler/` (84MB 로컬 상태)가 생깁니다. `.gitignore`에 추가해 뒀습니다.

### 2. 바인딩 누락 증상은 500이 아니라 `error code: 1101`

브리프 §5 표는 ".data 요청 500 → R2 바인딩 누락"으로 적고 있으나, 실제 CF Pages는
**HTTP 200 + `content-type: text/html` + 본문 `error code: 1101`** 로 응답합니다.
(1101 = Workers 스크립트가 예외를 던짐 → `env.WEBGL_ASSETS`가 undefined)

상태코드만 보면 정상으로 오인하기 쉬우므로 **본문을 확인**해야 합니다.

### 3. 검증은 반드시 GET으로 — `curl -I`(HEAD)는 오탐을 만듦

프록시 함수가 `onRequestGet`만 export하므로 **HEAD 요청은 함수를 타지 않고** `next()`로 빠져
정적 폴백(HTML)이 200으로 돌아옵니다. `curl -sI`로 검증하면 정상 동작 중에도
`content-type: text/html`이 보여 실패로 오인하게 됩니다.

```bash
# ❌ HEAD — 함수를 타지 않아 항상 text/html
curl -sI https://mazm-unity-webgl.pages.dev/Build/MazM_Studio_WebGL.wasm

# ✅ GET — 상태·크기·타입을 한 줄로
curl -s -o /dev/null -w '%{http_code} %{size_download} %{content_type}\n' \
  https://mazm-unity-webgl.pages.dev/Build/MazM_Studio_WebGL.wasm
```

> 알려진 제약(미조치): 브라우저·Unity 로더는 GET을 쓰므로 실동작에 영향 없음.
> 필요해지면 `functions/Build/[file].js`에 `export const onRequestHead = onRequestGet` 한 줄 추가로 해소 가능.

### 4. Pages 프로젝트 생성 경로가 대시보드에서 숨겨져 있음

**Create application → Continue with GitHub**을 누르면 **Workers** 마법사로 갑니다
(Deploy command `npx wrangler deploy`, Build output directory 칸 없음 → 이대로 배포하면 실패).
Pages 입구는 그 화면 **맨 아래 한 줄**입니다:

> Looking to deploy Pages? **Get started**

또는 직접: `https://dash.cloudflare.com/<account_id>/pages/new`
**"Build output directory" 칸이 보이면 Pages 흐름이 맞다**는 신호.

### 5. GitHub App 레포 권한은 소유자 계정 단위

- `birdy-mazm` **개인 계정** 설치: https://github.com/settings/installations → `unity-webgl`만 허용으로 설정 완료
- `storymazm` **조직**은 별도 설치·별도 설정이며, 현재 조직에 설치된 GitHub App은 **0개**
- 따라서 개인 계정 쪽 권한을 좁힌 것은 `storymazm/mazm-studio-web`에 영향 없음
  (참고: `mazm-studio-web`은 개인 계정이 아니라 `storymazm` 조직 소유의 private 레포)

---

## 진행 상황

| 단계 | 상태 | 비고 |
|---|---|---|
| 레포 클론 | ✅ 완료 | `a97feec Prod 2.8` 기준 |
| 브리프 → `.planning/` 이동 | ✅ 완료 | |
| §2 사전 준비 (CF 계정·R2 활성화·GitHub 권한) | ✅ 완료 | |
| §3① R2 버킷 생성 + 대용량 업로드 | ✅ 완료 | 바이트 일치 검증 통과 |
| §3② 프록시 함수 추가 | ✅ 완료 | `functions/Build/[file].js` |
| §3③ Pages 프로젝트 생성 + 바인딩 | ✅ 완료 | 바인딩 추가 후 Retry deployment 1회 수행 |
| §3④ 배포 검증 (curl 4항목) | ✅ 완료 | 아래 표 참조 |
| §3⑤ 골든패스 | ✅ **통과** | 2026-08-15 19:03 KST, Birdy 직접 확인 |

### §3④ 검증 결과 (GET 기준, 2026-08-15)

| 경로 | 상태 | 크기 | Content-Type | 판정 |
|---|---|---|---|---|
| `/Build/MazM_Studio_WebGL.data` | 200 | 88,042,055 | (없음) | ✅ 원본과 정확히 일치 |
| `/Build/MazM_Studio_WebGL.wasm` | 200 | 29,266,930 | `application/wasm` | ✅ 크기·타입 정상 |
| `/Build/MazM_Studio_WebGL.loader.js` | 200 | 26,982 | `application/javascript` | ✅ 프록시가 정적 파일 미간섭 |
| `/Build/MazM_Studio_WebGL.framework.js` | 200 | 414,939 | `application/javascript` | ✅ |
| `/` | 200 | 3,548 | `text/html` | ✅ |

배포 로그에 파일 크기 오류 없음. `Found Functions directory at /functions` + `Compiled Worker successfully` 확인,
에셋 업로드 3개(index.html·loader.js·framework.js) = build command가 대용량 2개를 정상 제거.

`.data`의 Content-Type이 비어 있는 것은 R2 객체에 메타데이터가 없기 때문이며, Unity 로더 동작에는 영향 없음.

---

## 커밋 이력

- `8421aef` — `functions/Build/[file].js` 프록시 추가, `.planning/` 신설, `.gitignore`
- `c20be78` — R2 업로드 결과 기록, `--remote` 정정 사항, `.wrangler/` ignore
- `7c94d60` — Pages 프로젝트 생성 + §3④ 배포 검증 통과 기록, 브리프 정정 3건
- (본 커밋) — 골든패스 통과 기록, 작업 완료 처리

---

## Jay 재빌드 시 절차

1. **작은 파일** (`index.html`, `*.loader.js`, `*.framework.js`): `git push` → CF Pages 자동 배포
2. **대용량 2개** (`.data`, `.wasm`): R2에 재업로드 — **`--remote` 반드시 포함**
   ```bash
   npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.data --file docs/Build/MazM_Studio_WebGL.data --remote
   npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.wasm --file docs/Build/MazM_Studio_WebGL.wasm --remote
   ```
3. 업로드 후 검증: `wrangler r2 object get ... --remote --file <임시경로>` 후 원본과 `cmp`

### 반영 시점 — 캐시는 브라우저에만 있음 (실측 확인)

프록시 응답 헤더는 `cache-control: public, max-age=3600` + `etag`.
**`cf-cache-status`·`age` 헤더가 없음** = Pages Functions 응답을 Cloudflare 엣지가 캐싱하지 않고
매 요청마다 R2에서 읽어옴. 따라서 이 1시간은 **순전히 브라우저 캐시**다.

| 상황 | 반영 |
|---|---|
| 처음 접속 / 캐시 없는 브라우저 | **즉시** |
| 최근 1시간 내 로드한 브라우저 | 최대 1시간 구버전 (재검증 없이 로컬 사본 사용) |
| 1시간 경과 후 | etag 재검증 → 변경 시 새로 받음 |

⚠️ **CF 대시보드 "캐시 퍼지"는 효과 없다.** 엣지가 캐시하지 않으므로 퍼지할 대상이 없고,
브라우저 캐시는 원격으로 삭제할 수 없다. 즉시 반영이 필요하면 **해당 PC에서 강제 새로고침**
(`⌘⇧R` / `Ctrl+Shift+R`)이 유일한 방법.

→ 운영 원칙: **재빌드·업로드는 수업 시작 최소 1시간 전에 완료할 것.**
   `max-age`를 낮추는 것도 가능하나, 30명이 84MB를 받는 환경에서 재접속 비용이 커지므로 권장하지 않음.

### 재빌드 시 확인 항목

- 새 `.data`가 **100MB에 근접하면 GitHub Pages는 git 파일당 100MB 하드리밋으로 자동 탈락** → CF가 유일한 서빙 경로가 됨.
  현재 88MB로 여유 약 12MB. 이 선을 넘는 순간 롤백 경로(GitHub Pages 병행 유지)가 사라지므로 재빌드마다 크기 확인 필요.
- 파일명이 바뀌면 `functions/Build/[file].js` 의 `R2_FILES` 목록도 함께 수정해야 함.

---

## 골든패스 결과 — ✅ 통과

**일시: 2026-08-15 19:03 KST / 확인자: Birdy (직접 확인, 브라우저)**
**대상: https://mazm-unity-webgl.pages.dev**

| 확인 항목 | 결과 |
|---|---|
| 게임 접근 (완전 로드) | ✅ 정상 |
| 로그인 | ✅ 정상 |
| 편집 | ✅ 정상 |
| 플레이 | ✅ 정상 |

→ R2 분리 서빙(84MB `.data` + 28MB `.wasm`) + Pages Functions 프록시 구조가 실동작으로 검증됨.
→ 로그인이 정상 동작했으므로, exec URL(브라우저→구글 직접 호출)과 Apps Script 익명 배포도
  새 오리진에서 성립하는 것으로 판단됨. (브리프 §0의 "미확인이면 골든패스에서 자연 검증" 항목 해소)

**계획 1번 작업(현 빌드 CF 이전 + 골든패스 검증) 완료.**

---

## 용량·한도 분석 (2026-08-15 공식 문서 기준)

### 이전 환경의 실질 병목

GitHub Pages는 **월 100GB 소프트 대역폭 한도**. 게임 1회 완전 로드 ≈ **112.5MB**
(`.data` 84 + `.wasm` 28 + js 0.44).

> 100GB ÷ 112.5MB ≈ **월 890회 로드** = 30명 학급 기준 **월 약 30개 학급이 상한**

소프트 리밋이라 초과 시 스로틀링·중단 가능. 수업 확대 시 실제로 부딪힐 수 있는 선이었음.

### 새 환경의 한도

| 자원 | 무료 한도 | 로드 1회당 | 환산 |
|---|---|---|---|
| **R2 송신(대역폭)** | **무료·무제한** | 112MB | **제약 없음** |
| Pages 정적 대역폭 | 문서상 명시 없음 | — | 사실상 제약 없음 |
| **Functions 요청** | **100,000/일** | 4회 | **일 25,000회 로드** |
| R2 읽기 (Class B) | 1,000만/월 | 2회 | 월 500만 회 로드 |
| R2 저장 | 10 GB-month | 0.117GB 사용 | 여유 98.8% |
| Pages 빌드 | 500/월 | 재빌드당 1회 | 무관 |
| Workers CPU | 10ms/요청 | 스트리밍 프록시 | 무관 |

`/Build/*` 4개 파일 모두 프록시 함수를 경유하므로 로드당 4 invocation으로 계산.

> **30명 학급 = 120요청 → 하루 833개 학급까지 가능.**
> 이전 *월* 30학급 → 새 환경 *일* 833학급 (약 800배 여유).

**결론: 대역폭 기준 월 사용량 제약은 해소됨.** 남은 한도는 일일 요청 수이며 수업 규모로는 도달 불가.

### 안정성 평가 — 개선과 신규 취약점

**개선(인프라)**
- 대역폭 초과로 사이트가 내려갈 위험 제거 (최대 개선점)
- 글로벌 엣지 서빙

**신규 취약점(운영)**
- 구성 요소가 1개(정적 파일) → **3개(Pages + Functions + R2)** 로 증가 → 장애 지점 증가
- ⚠️ **R2 업로드가 수동**: Jay가 push해도 Birdy가 업로드를 누락하면 **구버전이 조용히 계속 서빙**됨.
  에러가 발생하지 않아 탐지가 어려움 — **현 구조에서 가장 현실적인 리스크**
- 무료 플랜이라 SLA 없음

→ 현재는 [`jay-rebuild-handoff.md`](./jay-rebuild-handoff.md) 체크리스트로 방어.
  재빌드 빈도가 올라가면 **GitHub Actions로 push 시 R2 자동 업로드** 자동화를 검토할 것.

출처: Workers Free 100,000 req/day · 10ms CPU / R2 free tier 10GB·1M Class A·10M Class B·egress free
/ Pages 500 builds/month·25MiB per file / GitHub Pages 100GB soft bandwidth per month.

---

## 다음 단계 (브리프 §4 — 이번 작업에서 의도적으로 하지 않은 것)

- [x] **CF 플레이 링크 컬럼 추가** — 2026-08-15 완료·테스트 통과.
      `codes` 시트 I열 `(CF)Play Link`. 상세는 [`apps-script-play-links.md`](./apps-script-play-links.md)
- [ ] **교사 안내 URL 교체** — **보류 중** (2026-08-15 시점). 브리프 §4대로 실제 수업 1회 이상 검증 후 진행
- [ ] **GitHub Pages 중단** — 아직 하지 않음. 병행 유지 = 롤백 경로
- [ ] 커스텀 도메인, 압축 최적화 — 필요 시 별도 건
- [ ] `mazm-studio-web` 자동 배포 확인 — 별건. CF에 옛 레포 경로(`birdy-mazm/mazm-studio-web`)가
      연결돼 있으나 해당 레포는 `storymazm` 조직으로 이전됨. 다음 push 시 배포 여부 확인 필요

### 신규 웹 스튜디오로 이관한 제약 요건

초기 로딩 112MB 문제는 CF 이전으로 해소되지 않는다(대역폭이 아니라 페이로드 문제).
실측·분석과 신규 버전 요구사항을 [`payload-constraints-for-next-version.md`](./payload-constraints-for-next-version.md)
에 정리했으며, **사본을 신규 개발 프로젝트의 planning으로 이관함(2026-08-15).**
이후 요구사항 조정은 신규 프로젝트 쪽 사본에서 이루어진다.

### 남은 알려진 제약

- HEAD 요청은 프록시 함수를 타지 않음 (위 §3 정정 참조). 실동작 영향 없음, 필요 시 1줄로 해소 가능.
- `.data` 88MB — GitHub Pages 100MB 하드리밋까지 여유 약 12MB. 재빌드 시 크기 확인 필요.

---

## v2 (3.0 재빌드) — 경로·파일명 변경 대응 (2026-08-31)

### 배경

`v2` 브랜치(제이 커밋 `4c1d1bb`)에서 CF 배포가 다음 오류로 실패:

```
Build/Build/Build.data is 84.9 MiB
```

원인 조사 결과, 이번 재빌드는 [`jay-rebuild-handoff.md`](./jay-rebuild-handoff.md) §2("파일명을 바꾸지 마세요")를 따르지 않고
Unity Product Name(또는 산출물 구조)이 바뀌어 파일명·경로가 `MazM_Studio_WebGL.*` → `Build/Build/Build.*` 로 변경됨.
게다가 **옛 파일을 지우지 않고 새 파일을 추가만** 했고, `docs/Build/index.html`이라는 **`docs/index.html`과 바이트 단위로 동일한 잔재 파일**도 함께 커밋됨.

### 조사 결과 — `docs/` 구조 (v2, `4c1d1bb` 기준)

| 파일 | 크기 | 25MiB 초과 | 비고 |
|---|---|---|---|
| `docs/Build/Build/Build.data` | 89,075,480 B (84.9 MiB) | ✅ 초과 | 신규(제이) |
| `docs/Build/Build/Build.wasm` | 41,085,993 B (39.2 MiB) | ✅ 초과 | 신규(제이). 옛 wasm(27.9MiB)보다 커짐 |
| `docs/Build/Build/Build.framework.js` | 455,302 B | — | 신규(제이) |
| `docs/Build/Build/Build.loader.js` | 26,982 B | — | 신규(제이) |
| `docs/Build/MazM_Studio_WebGL.data` | 88,042,055 B (84.0 MiB) | ✅ 초과 | 구버전 잔존 (삭제 안 됨) |
| `docs/Build/MazM_Studio_WebGL.wasm` | 29,266,930 B (27.9 MiB) | ✅ 초과 | 구버전 잔존 |
| `docs/Build/MazM_Studio_WebGL.framework.js` | 414,939 B | — | 구버전 잔존 |
| `docs/Build/MazM_Studio_WebGL.loader.js` | 26,982 B | — | 구버전 잔존 |
| `docs/index.html` | 3,548 B | — | 사이트 루트 진입점 |
| ~~`docs/Build/index.html`~~ | 3,548 B | — | **삭제함** — `docs/index.html`과 완전 동일한 잔재 |

CF Pages는 참조 여부와 무관하게 출력 디렉터리 내 **모든 파일**을 25MiB 기준으로 검사하므로,
옛 2개 + 신규 2개 = **총 4개 파일이 배포를 막고 있었음** (에러 메시지는 그중 하나만 표시).

**더 심각한 문제**: `docs/index.html`이 여전히 `MazM_Studio_WebGL.*`을 참조하고 있어서, 배포 실패를 해결해도
게임은 계속 구버전을 로드하고 신규 3.0 빌드는 전혀 쓰이지 않는 상태였음. (Birdy 확인 후 수정 진행)

### 조치 (v2 브랜치, 커밋 예정)

1. **`docs/index.html`** — 참조 경로를 신규 파일명으로 수정
   - `buildPath`: `Build` → `Build/Build`
   - `MazM_Studio_WebGL.loader.js` / `.data` / `.framework.js` / `.wasm` → `Build.loader.js` / `.data` / `.framework.js` / `.wasm`
2. **`docs/Build/index.html` 삭제** — `docs/index.html`과 동일한 잔재 파일
3. **`functions/Build/Build/[file].js` 신규 추가** — 새 중첩 경로(`/Build/Build/*`) 프록시
   ```js
   const R2_FILES = new Set(["Build.data", "Build.wasm"]);
   // 로직은 functions/Build/[file].js와 동일, 파일명만 신규 기준
   ```
4. **`functions/Build/[file].js`(기존)는 그대로 유지** — `R2_FILES = {MazM_Studio_WebGL.data, MazM_Studio_WebGL.wasm}`
   - main이 CF에서 빠지기 전까지 프로덕션(main) 보호
   - CF Pages의 단일 세그먼트 동적 라우트(`[file]`)는 `/Build/Build/...`(2세그먼트)와 겹치지 않으므로 두 함수가 충돌 없이 공존함
5. **`docs/Build/MazM_Studio_WebGL.*` 4개 파일을 v2에서 삭제** (2026-08-31 후속 조치)
   - v2의 `docs/index.html`이 더 이상 이 파일들을 참조하지 않으므로 v2 트리에는 불필요
   - `main`에는 원본이 그대로 남아 있어 안전 (main 프로덕션 배포에는 영향 없음 — 브랜치별로 독립적인 커밋 트리를 배포)
   - ⚠️ 캐치: `.data`/`.wasm`은 R2 오브젝트가 이미 있어 `functions/Build/[file].js` 프록시로 계속 응답 가능하지만, `.loader.js`/`.framework.js`(정적 폴백 대상)는 로컬 파일이 사라졌으므로 v2 배포에서 옛 경로로 요청하면 404. v2 전환 직후 브라우저 캐시에 구버전 `index.html`이 남아 있는 사용자는 이 두 파일 요청이 실패할 수 있음 — 캐시 만료(`max-age=3600`, 최대 1시간) 이후에는 문제 없음

### CF 빌드 커맨드 — v2 프로젝트 대시보드에 설정할 값

**Build command** (대시보드에서 이 값으로 교체):
```
rm -f docs/Build/Build/Build.data docs/Build/Build/Build.wasm
```

**Build output directory**: `docs` (변경 없음)

옛 `MazM_Studio_WebGL.*` 4개는 v2 트리에서 이미 삭제됐으므로 빌드 커맨드에 옛 경로 삭제는 불필요 — 25MiB 초과인 신규 2개만 지우면 됨. R2 바인딩(`WEBGL_ASSETS` → `webgl-assets`)은 기존과 동일하게 유지 — 신규 키(`Build.data`, `Build.wasm`)도 같은 버킷에 저장하면 되므로 바인딩 추가 작업 불필요.

### R2 업로드 — ✅ 완료 (2026-08-31)

```bash
npx wrangler r2 object put webgl-assets/Build.data --file docs/Build/Build/Build.data --remote
npx wrangler r2 object put webgl-assets/Build.wasm --file docs/Build/Build/Build.wasm --remote
```

두 건 모두 `Resource location: remote` 확인. 업로드 후 `wrangler r2 object get ... --remote`로 재다운로드하여 `cmp`로 원본과 바이트 단위 대조 — **완전 일치**.

| 파일 | 크기 | 검증 |
|---|---|---|
| `Build.data` | 89,075,480 B | ✅ `cmp` 일치 |
| `Build.wasm` | 41,085,993 B | ✅ `cmp` 일치 |

업로드 후 배포 검증 (기존 방식과 동일 — GET만 유효, HEAD는 오탐):
```bash
B=https://<v2-project-또는-preview-URL>
for p in /Build/Build/Build.data /Build/Build/Build.wasm; do
  echo -n "$p  "
  curl -s -o /dev/null -w '%{http_code} %{size_download} %{content_type}\n' "$B$p"
done
```
기대값: `.data` → `200 89075480`, `.wasm` → `200 41085993 application/wasm`.

### 미해결 / 확인 필요

- [x] R2에 `Build.data`, `Build.wasm` 업로드 — 2026-08-31 완료, 바이트 검증 통과
- [x] CF 대시보드에서 v2 프로젝트의 Build command를 `rm -f docs/Build/Build/Build.data docs/Build/Build/Build.wasm` 로 교체 — 2026-08-31 Birdy 설정 완료
- [ ] 재배포 후 위 curl 검증 통과 확인

#### ⚠️ 1차 배포 검증 결과 (2026-08-31, `https://bd952191.mazm-unity-webgl.pages.dev`)

| 경로 | 상태 | 본문/타입 | 판정 |
|---|---|---|---|
| `/Build/Build/Build.data` | **500** | `error code: 1101` | ❌ 실패 |
| `/Build/Build/Build.wasm` | **500** | `error code: 1101` | ❌ 실패 |
| `/Build/Build/Build.loader.js` | 200 | `application/javascript` | ✅ |
| `/Build/Build/Build.framework.js` | 200 | `application/javascript` | ✅ |
| `/` | 200 | `text/html` | ✅ |

**원인 (기존 §"바인딩 누락 증상은 500이 아니라 error code: 1101" 재현)**: `env.WEBGL_ASSETS`가 undefined → Functions 예외.
정적 파일은 정상 응답했으므로 코드/라우팅 문제가 아니라 **R2 바인딩 누락**으로 특정됨.

이 URL은 브랜치 해시가 붙은 **Preview 배포**. CF Pages는 Production/Preview 환경별로 바인딩이 분리되므로,
최초 마이그레이션 때 설정한 `WEBGL_ASSETS` 바인딩이 Preview 환경에는 적용되지 않았을 가능성이 높음.

**조치 필요 (대시보드)**: Settings → Functions → R2 bucket bindings에서 `WEBGL_ASSETS` → `webgl-assets`가
**Preview** 환경에도 설정돼 있는지 확인 → 없으면 추가 → 재배포(Retry deployment).

- [ ] R2 바인딩을 Preview 환경에도 추가
- [ ] 재배포 후 위 curl 검증 재통과 확인
- [ ] 브라우저 골든패스 확인 (게임 로드·로그인·편집·플레이)
- [ ] `.wasm`이 39.2MiB로 커짐 — GitHub Pages 100MB 하드리밋 관련 여유는 이제 무관(CF가 유일한 서빙 경로로 전환 예정이므로)하지만, R2 저장·대역폭 산정 시 참고
- [ ] v2가 검증되면 CF Pages 프로덕션 브랜치를 main → v2로 전환할지, v2를 main에 머지할지 결정 필요. 그 시점에 옛 라우팅(`functions/Build/[file].js`)과 구버전 R2 오브젝트 정리 여부 재검토
