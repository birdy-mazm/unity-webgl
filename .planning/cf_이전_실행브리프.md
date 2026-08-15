# CF Pages 이전 — 실행 브리프

> 작성일: 2026-08-13 (Claude.ai 2-2 트랙 세션에서 확정)
> 목적: 웹지엘 안정화 계획 1번 작업(현 빌드 CF 이전 + 골든패스 검증)의 데스크톱 실행 지침
> 타임박스: **1일. 골든패스까지 안 되면 중단하고 상태를 `.planning/cf-migration.md`에 기록 후 종료.**
> 롤백: 기존 GitHub Pages·교사 URL·빌드 파일은 일절 수정하지 않음 → 실패 시 CF 쪽만 폐기하면 됨.

---

## 0. 확정된 사실 (재조사 불필요)

- 레포: `github.com/birdy-mazm/unity-webgl`, 빌드 위치 `docs/`, 서빙 경로 `/Build/...`
- 파일 크기: `.data` **84MB**, `.wasm` **28MB** — 둘 다 CF Pages 파일당 25MB 제한 초과
- 압축 테스트 완료: `.data`는 brotli로도 **74.6MB** (에셋이 이미 압축 형식) → **재빌드·압축으로 해결 불가, R2 분리 서빙 확정**
- `.wasm`은 brotli 시 7.7MB이지만, 구조 단순화를 위해 `.data`와 함께 R2로 보냄 (혼합 방식 금지)
- exec URL은 빌드에 하드코딩된 브라우저→구글 직접 호출 → 서빙 위치와 무관, 아무것도 수정하지 않음
- Apps Script는 "모든 사용자(익명)" 배포 확인 필요 — 미확인이면 골든패스에서 자연 검증됨

## 1. 아키텍처

```
브라우저
 ├─ /index.html, /Build/*.js        → CF Pages (Git 연동, 자동 배포)
 └─ /Build/*.data, /Build/*.wasm    → Pages Functions 프록시 → R2 버킷
```

- 같은 오리진 서빙 → CORS 불필요, index.html 수정 불필요, 재빌드 불필요
- 이후 Jay 재빌드 시: 작은 파일은 git push로 자동 배포, 대용량 2개만 R2에 재업로드 (절차를 §6에 기록)

## 2. Birdy 사전 준비 (세션 시작 전, 사람이 직접)

- [ ] Cloudflare 계정 생성 (무료 플랜)
- [ ] **R2 활성화 — 결제수단(카드) 등록 필요.** 무료 티어(저장 10GB, 송신 무료)로 과금 없음
- [ ] Cloudflare ↔ GitHub 연동 시 `birdy-mazm/unity-webgl` 레포 접근 권한 승인

## 3. 작업 순서

### ① R2 버킷 + 대용량 업로드
- 버킷 생성: `webgl-assets` (지역 APAC)
- 업로드 (파일이 커서 대시보드보다 wrangler 권장):
  ```bash
  npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.data --file docs/Build/MazM_Studio_WebGL.data
  npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.wasm --file docs/Build/MazM_Studio_WebGL.wasm
  ```
- 검증: `npx wrangler r2 object get`으로 크기 일치 확인

### ② 레포에 프록시 함수 추가
- `functions/Build/[file].js` (레포 루트 기준 — 출력 디렉터리와 무관하게 루트의 `functions/`를 읽음):
  ```js
  const R2_FILES = new Set([
    "MazM_Studio_WebGL.data",
    "MazM_Studio_WebGL.wasm",
  ]);

  export async function onRequestGet({ params, env, next }) {
    if (!R2_FILES.has(params.file)) return next(); // .js 등은 Pages 정적 파일로 통과

    const obj = await env.WEBGL_ASSETS.get(params.file);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("Cache-Control", "public, max-age=3600");
    if (params.file.endsWith(".wasm")) {
      headers.set("Content-Type", "application/wasm"); // 미설정 시 로딩 저하
    }
    return new Response(obj.body, { headers });
  }
  ```

### ③ Pages 프로젝트 생성 (Git 연동)
- 레포 연결: `birdy-mazm/unity-webgl`, 브랜치 `main`
- 빌드 설정:
  - Build command: `rm -f docs/Build/MazM_Studio_WebGL.data docs/Build/MazM_Studio_WebGL.wasm`
    (**25MB 초과 파일이 산출물에 있으면 배포가 거부됨** — 첫 배포 실패의 최다 원인, 반드시 설정)
  - Build output directory: `docs`
- 바인딩: Settings → Functions → R2 bucket bindings → 변수명 `WEBGL_ASSETS` → 버킷 `webgl-assets`
- 바인딩 추가 후 재배포 1회 (바인딩은 다음 배포부터 적용)

### ④ 배포 검증 (Claude가 확인)
- [ ] 배포 로그에 파일 크기 오류 없음
- [ ] `curl -sI https://<프로젝트>.pages.dev/Build/MazM_Studio_WebGL.data` → 200, Content-Length ≈ 84MB
- [ ] `curl -sI .../Build/MazM_Studio_WebGL.wasm` → 200, `Content-Type: application/wasm`
- [ ] `curl -sI .../Build/MazM_Studio_WebGL.loader.js` → 200 (프록시가 정적 파일을 가로채지 않는지)

### ⑤ 골든패스 (Birdy 직접 — Claude 보고로 갈음 금지)
- [ ] `https://<프로젝트>.pages.dev` 접속 → 게임 완전 로드
- [ ] 교사 코드 입력 → 시트 링크 검증 통과 (= Apps Script 익명 호출이 새 오리진에서 정상)
- [ ] 스토리 진행 1~2개 챕터 확인

## 4. 하지 않는 것

- GitHub Pages 중단 ❌ (병행 유지 = 롤백 경로)
- 교사 안내 URL 교체 ❌ (CF에서 수업 1회 이상 검증 후)
- index.html·빌드 파일 수정 ❌
- 커스텀 도메인, 압축 최적화 ❌ (동작 우선, 최적화는 필요 시 별도)

## 5. 막힐 때 판단 기준

| 증상 | 원인 후보 | 조치 |
|---|---|---|
| 첫 배포 실패 (file too large) | build command 미설정 | §3-③ 빌드 커맨드 확인 |
| .data 요청 500 | R2 바인딩 누락/이름 불일치 | 바인딩 `WEBGL_ASSETS` 확인 후 재배포 |
| .data 요청 404 | R2 객체 키 불일치 | 버킷 내 파일명 = 요청 파일명 확인 |
| 게임 로드 중 멈춤 | .wasm Content-Type | ④의 curl 헤더 확인 |
| 교사 코드 검증 실패 | Apps Script 배포가 익명 아님 | 계획 2번 작업(Jay 권한 이전)으로 에스컬레이션 — 이 세션에서 해결 시도 금지 |

## 6. 종료 시 기록 (`.planning/cf-migration.md`)

- pages.dev URL, R2 버킷명, 바인딩 변수명
- 골든패스 결과 (일시, 확인 항목)
- **Jay 재빌드 시 절차**: 작은 파일 git push → 자동 배포 / .data·.wasm 2개 wrangler로 R2 재업로드 → 캐시 1시간 내 자동 갱신
- **재빌드 시 확인 항목**: 새 .data가 100MB 근접하면 GitHub Pages는 git 하드리밋으로 자동 탈락 → CF가 유일 경로가 됨을 기록
