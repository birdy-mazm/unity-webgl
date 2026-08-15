# CF Pages 이전 — 진행 기록

> 실행 브리프: [`cf_이전_실행브리프.md`](./cf_이전_실행브리프.md)
> 상태: **진행 중 — ③ Pages 프로젝트 생성 대기 (CF 대시보드 수동 작업)**
> 최종 갱신: 2026-08-15

---

## 확정 정보

| 항목 | 값 |
|---|---|
| 레포 | `github.com/birdy-mazm/unity-webgl` (개인 계정 소유, public, 브랜치 `main`) |
| 빌드 출력 디렉터리 | `docs` |
| CF 계정 | `birdy@storymazm.com` (계정 1개, Account ID는 `wrangler whoami`로 확인) |
| R2 버킷명 | `webgl-assets` (location hint `apac`, Standard) — ✅ 생성됨 |
| R2 바인딩 변수명 | `WEBGL_ASSETS` — ⛔ 미설정 (Pages 프로젝트 생성 후) |
| pages.dev URL | ⛔ 미정 (Pages 프로젝트 미생성) |

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

### 2. GitHub App 레포 권한은 소유자 계정 단위

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
| §3③ Pages 프로젝트 생성 + 바인딩 | ⛔ **대기** | CF 대시보드 — Birdy 수동 작업 |
| §3④ 배포 검증 (curl 4항목) | ⬜ 미착수 | ③ 이후, Claude 처리 |
| §3⑤ 골든패스 | ⬜ 미착수 | Birdy 직접 확인 (보고로 갈음 금지) |

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
