# CF Pages 이전 — 진행 기록

> 실행 브리프: [`cf_이전_실행브리프.md`](./cf_이전_실행브리프.md)
> 상태: **§3④ 배포 검증까지 통과 — ⑤ 골든패스(Birdy 직접 확인)만 남음**
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
| §3⑤ 골든패스 | ⛔ **대기** | Birdy 직접 확인 (보고로 갈음 금지) |

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
- (본 커밋) — R2 업로드 결과 기록, `--remote` 정정 사항, `.wrangler/` ignore

---

## Jay 재빌드 시 절차

1. **작은 파일** (`index.html`, `*.loader.js`, `*.framework.js`): `git push` → CF Pages 자동 배포
2. **대용량 2개** (`.data`, `.wasm`): R2에 재업로드 — **`--remote` 반드시 포함**
   ```bash
   npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.data --file docs/Build/MazM_Studio_WebGL.data --remote
   npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.wasm --file docs/Build/MazM_Studio_WebGL.wasm --remote
   ```
   프록시가 `Cache-Control: public, max-age=3600` 을 내보내므로 **최대 1시간 내 자동 갱신**.
   즉시 반영이 필요하면 CF 대시보드에서 캐시 퍼지.
3. 업로드 후 검증: `wrangler r2 object get ... --remote --file <임시경로>` 후 원본과 `cmp`

### 재빌드 시 확인 항목

- 새 `.data`가 **100MB에 근접하면 GitHub Pages는 git 파일당 100MB 하드리밋으로 자동 탈락** → CF가 유일한 서빙 경로가 됨.
  현재 88MB로 여유 약 12MB. 이 선을 넘는 순간 롤백 경로(GitHub Pages 병행 유지)가 사라지므로 재빌드마다 크기 확인 필요.
- 파일명이 바뀌면 `functions/Build/[file].js` 의 `R2_FILES` 목록도 함께 수정해야 함.

---

## 골든패스 결과

*(미실시 — §3⑤ 완료 후 일시·확인 항목 기록)*
