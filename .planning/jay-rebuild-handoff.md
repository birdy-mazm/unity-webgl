# WebGL 재빌드 안내 (Jay 전달용)

> 대상: Jay / 작성: Birdy · 2026-08-15
> 배경: WebGL 서빙 위치가 GitHub Pages → **Cloudflare Pages**로 이전되었습니다.
> 운영 URL: **https://mazm-unity-webgl.pages.dev**

---

## 한 줄 요약

**빌드 넣고 push하는 방법은 기존과 똑같습니다.** 다만 push 후 Birdy가 할 작업이 하나 더 있어서,
**push를 마치면 Birdy에게 알려주시면 됩니다.**

---

## 1. 빌드 반영 방법 (기존과 동일)

1. `docs/Build/` 에 Unity WebGL 산출물을 넣습니다
2. `main` 브랜치에 push
3. push하면 자동 배포됩니다

`index.html`과 `/Build/` 경로 구조는 **수정하지 마세요.** 서버 설정이 이 구조를 전제로 합니다.

## 2. ⚠️ 파일명을 바꾸지 마세요

현재 아래 4개 파일명이 서버 설정에 하드코딩되어 있습니다.

```
MazM_Studio_WebGL.data
MazM_Studio_WebGL.wasm
MazM_Studio_WebGL.loader.js
MazM_Studio_WebGL.framework.js
```

Unity의 **Product Name을 변경하면 이 이름들이 전부 바뀌어 게임이 로드되지 않습니다.**
바꿔야 할 사정이 생기면 **push 전에 먼저 알려주세요** (서버 설정을 함께 수정해야 합니다).

## 3. ⚠️ `.data` 파일 크기를 알려주세요

- 현재 `MazM_Studio_WebGL.data` = **88MB**
- **100MB를 넘으면 GitHub이 push 자체를 거부합니다** (파일당 100MB 하드리밋)
- 여유가 **약 12MB뿐**이므로, 에셋이 늘었다면 **push 전에 크기를 알려주세요**

## 4. push 후 Birdy에게 알려주세요 (중요)

`.data`와 `.wasm` 2개는 용량이 커서 별도 스토리지(R2)에서 서빙됩니다.
**push만으로는 이 2개가 갱신되지 않아 구버전이 계속 나갑니다.**

→ **push 완료 후 Birdy에게 알려주세요.** Birdy가 10분 내로 처리합니다.

## 5. 반영 확인

Birdy의 업로드까지 끝나면 새 버전이 반영됩니다.

- 처음 접속하는 PC → **즉시** 새 버전
- **최근 1시간 내 게임을 열어본 브라우저 → 구버전이 보일 수 있습니다** (브라우저 캐시)
  - 이 경우 **강제 새로고침**(`⌘⇧R` / `Ctrl+Shift+R`)하면 바로 새 버전이 뜹니다

확인 URL: **https://mazm-unity-webgl.pages.dev**

## 6. 참고

- 기존 GitHub Pages 주소도 당분간 **함께 유지**됩니다 (문제 발생 시 되돌아갈 경로)
- 교사 안내 URL은 아직 교체하지 않았습니다 (실제 수업 검증 후 교체 예정)

---
---

# ▼ 이하 Birdy 전용 (Jay에게 전달 불필요)

## push 받은 뒤 실행

```bash
cd ~/Projects/unity-webgl
git pull

npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.data --file docs/Build/MazM_Studio_WebGL.data --remote
npx wrangler r2 object put webgl-assets/MazM_Studio_WebGL.wasm --file docs/Build/MazM_Studio_WebGL.wasm --remote
```

**`--remote`가 빠지면 로컬 시뮬레이션에만 저장되는데 `Upload complete.`가 똑같이 출력됩니다.**
성공한 줄 알고 넘어가기 쉬우므로 반드시 확인할 것. (`Resource location: remote` 가 찍혀야 정상)

## 업로드 후 검증

```bash
B=https://mazm-unity-webgl.pages.dev
for p in /Build/MazM_Studio_WebGL.data /Build/MazM_Studio_WebGL.wasm; do
  echo -n "$p  "
  curl -s -o /dev/null -w '%{http_code} %{size_download} %{content_type}\n' "$B$p"
done
```

- 상태 `200`, 크기가 `docs/Build/` 원본과 **정확히 일치**해야 함
- `.wasm`은 `application/wasm` 이어야 함
- **`curl -I`(HEAD)로 확인하지 말 것** — 프록시 함수를 타지 않아 정상 동작 중에도 `text/html`이 나옵니다

## 체크리스트

- [ ] Jay가 알려준 `.data` 크기가 100MB 미만인가
- [ ] 파일명 4개가 그대로인가 (바뀌었다면 `functions/Build/[file].js`의 `R2_FILES`도 수정)
- [ ] `git pull` 후 R2 업로드 2건 (`--remote` 포함)
- [ ] 위 curl 검증 통과
- [ ] 브라우저에서 실제 로드 확인
- [ ] **수업 시작 최소 1시간 전에 완료** (브라우저 캐시 `max-age=3600`)

상세 배경·정정 사항은 [`cf-migration.md`](./cf-migration.md) 참조.
