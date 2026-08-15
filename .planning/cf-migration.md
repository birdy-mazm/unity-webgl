# CF Pages 이전 — 진행 기록

> 실행 브리프: [`cf_이전_실행브리프.md`](./cf_이전_실행브리프.md)
> 상태: **진행 중 — ①R2 업로드에서 대기 (wrangler 로그인 필요)**
> 최종 갱신: 2026-08-15

---

## 확정 정보

| 항목 | 값 |
|---|---|
| 레포 | `github.com/birdy-mazm/unity-webgl` (브랜치 `main`) |
| 빌드 출력 디렉터리 | `docs` |
| R2 버킷명 | `webgl-assets` (지역 APAC) — **미생성** |
| R2 바인딩 변수명 | `WEBGL_ASSETS` — **미설정** |
| pages.dev URL | **미정 (Pages 프로젝트 미생성)** |

### 실측 파일 크기 (클론 후 확인)

| 파일 | 크기 | 서빙 경로 |
|---|---|---|
| `MazM_Studio_WebGL.data` | 88,042,055 B (84.0 MiB) | R2 프록시 |
| `MazM_Studio_WebGL.wasm` | 29,266,930 B (27.9 MiB) | R2 프록시 |
| `MazM_Studio_WebGL.framework.js` | 414,939 B | CF Pages 정적 |
| `MazM_Studio_WebGL.loader.js` | 26,982 B | CF Pages 정적 |

브리프 §0의 크기 전제(.data 84MB / .wasm 28MB)와 일치. 두 파일 모두 CF Pages 25MB 제한 초과 → R2 분리 확정.

---

## 진행 상황

| 단계 | 상태 | 비고 |
|---|---|---|
| 레포 클론 | ✅ 완료 | `a97feec Prod 2.8` 기준 |
| 브리프 → `.planning/` 이동 | ✅ 완료 | |
| §3① R2 버킷 생성 + 대용량 업로드 | ⛔ **대기** | wrangler 미인증 — Birdy 조치 필요 |
| §3② 프록시 함수 추가 | ✅ 완료 | `functions/Build/[file].js` |
| §3③ Pages 프로젝트 생성 + 바인딩 | ⛔ **대기** | CF 대시보드 조작 — Birdy 조치 필요 |
| §3④ 배포 검증 (curl) | ⬜ 미착수 | ③ 이후 |
| §3⑤ 골든패스 | ⬜ 미착수 | Birdy 직접 확인 |

### Birdy 조치 대기 항목

1. **Cloudflare 계정 + R2 활성화** (브리프 §2 사전 준비) — 결제수단 등록 필요
2. **`wrangler login`** — 브라우저 OAuth. 완료 후 알려주면 ①부터 재개
3. **Pages 프로젝트 생성 + R2 바인딩** (§3③) — 대시보드 작업

---

## 커밋 이력

- `functions/Build/[file].js` 추가 — R2 프록시 (브리프 §3② 그대로)
- `.gitignore` 추가 — `.DS_Store`, GSD 툴링 산출물 제외

---

## Jay 재빌드 시 절차

*(§6 요구 항목 — 골든패스 통과 후 확정)*

1. **작은 파일** (`index.html`, `*.loader.js`, `*.framework.js`): `git push` → CF Pages 자동 배포
2. **대용량 2개** (`.data`, `.wasm`): R2에 재업로드
   ```bash
   npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.data --file docs/Build/MazM_Studio_WebGL.data
   npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.wasm --file docs/Build/MazM_Studio_WebGL.wasm
   ```
   `Cache-Control: max-age=3600` → **최대 1시간 내 자동 갱신**. 즉시 반영이 필요하면 CF 캐시 퍼지.

### 재빌드 시 확인 항목

- 새 `.data`가 **100MB에 근접하면 GitHub Pages는 git 하드리밋(파일당 100MB)으로 자동 탈락** → CF가 유일한 서빙 경로가 됨.
  현재 88MB로 여유 12MB. 이 선을 넘는 순간 롤백 경로(GitHub Pages 병행)가 사라지므로, 재빌드 때마다 크기를 확인할 것.

---

## 골든패스 결과

*(미실시 — §3⑤ 완료 후 일시·확인 항목 기록)*
