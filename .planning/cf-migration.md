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

## 다음 단계 (브리프 §4 — 이번 작업에서 의도적으로 하지 않은 것)

- [ ] **GitHub Pages 중단** — 아직 하지 않음. 병행 유지 = 롤백 경로
- [ ] **교사 안내 URL 교체** — CF에서 **실제 수업 1회 이상 검증 후** 진행
- [ ] 커스텀 도메인, 압축 최적화 — 필요 시 별도 건

### 남은 알려진 제약

- HEAD 요청은 프록시 함수를 타지 않음 (위 §3 정정 참조). 실동작 영향 없음, 필요 시 1줄로 해소 가능.
- `.data` 88MB — GitHub Pages 100MB 하드리밋까지 여유 약 12MB. 재빌드 시 크기 확인 필요.
