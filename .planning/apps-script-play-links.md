# Apps Script · 플레이 링크 구조 (조사 기록)

> 조사일: 2026-08-15
> 계기: CF 이전 후 `(CF)Play Link` 컬럼 추가 검토
> 관리 시트: `1PstRjANAN_uwVG-8seHZ7iOcO9EM_RZgyCQYZb9dHhY`

---

## 결론 요약

**플레이 링크는 Apps Script가 아니라 시트 수식이 만든다.** 따라서 링크 추가·변경에
스크립트 수정도, 재배포도, Jay의 재빌드도 필요 없다.

---

## Apps Script

| 항목 | 값 |
|---|---|
| 프로젝트명 | `AuthScript_WebGL` (관리 시트에 바인딩) |
| 소유·실행 계정 | `birdy@storymazm.com` |
| 액세스 | **모든 사용자(익명)** — 브리프 §0 미확인 항목 해소 |
| 코드 상수 | `GAS_VERSION = "v2026-06-12-whitelist-play-v1"` |

### ⚠️ 활성 배포가 6개 — 게임이 쓰는 것은 하나뿐

빌드에 하드코딩된 exec URL로 대조한 결과:

```
macros/s/AKfycbxMTA2b6K-b5SqZxEb_LgUBzIkGb7FvDu8reznVF9TDirviU_Iz9sZXPnHjueZYzsoM/exec
```

| 항목 | 값 |
|---|---|
| **라이브 배포** | **"화이트리스트"** |
| **현재 버전** | **버전 13 (2026-06-19 오후 1:21)** ← **롤백 지점** |
| 나머지 5개 | `제목 없음`×3, `Blacklisted`, `시트 링크 버전` — **게임과 무관, 건드리지 말 것** |

배포가 특정 버전에 고정돼 있으므로 **코드를 저장해도 실서비스는 바뀌지 않는다.**
반영은 이 배포를 명시적으로 새 버전으로 올릴 때만 일어난다.

### 스크립트가 실제로 쓰는 컬럼 (codes 시트)

`handleAuthRequest()` 는 **D·E·F 3개만** 기록한다.

```js
codeSheet.getRange(i + 1, 4).setValue(sheetId);          // D: SheetId
codeSheet.getRange(i + 1, 5).setFormula(...시트 열기...);  // E: SheetLink
codeSheet.getRange(i + 1, 6).setValue(new Date());        // F: LastLogin
```

**G·H(Play Link)를 쓰는 코드는 없다.** 코드 안의 `github.io`는 `handlePlayRequest`
위쪽 **주석**일 뿐 실행되지 않는다.

---

## 플레이 링크 = 시트 수식

`codes` 시트 1행의 배열 수식이 D열을 받아 링크를 생성한다.

```
G1: ={"(Prod)Play Link"; ARRAYFORMULA(IF(D2:D="","",HYPERLINK(blacklist!$A$3 & "?resetPrefs=1&sheetLink=" & D2:D, "Link")))}
H1: ={"(Dev) Play Link";  ARRAYFORMULA(IF(D2:D="","",HYPERLINK(blacklist!$A$4 & "?resetPrefs=1&sheetLink=" & D2:D, "Link")))}
I1: ={"(CF)Play Link";    ARRAYFORMULA(IF(D2:D="","",HYPERLINK(blacklist!$A$2 & "?resetPrefs=1&sheetLink=" & D2:D, "Link")))}
```

### 베이스 URL은 `blacklist` 시트 A열에 있음

`blacklist` 시트는 **차단 목록과 URL 설정을 겸한다.**

| 셀 | 값 | 용도 |
|---|---|---|
| `A2` | `https://mazm-unity-webgl.pages.dev/` | **CF (신규)** |
| `A3` | `https://birdy-mazm.github.io/unity-webgl/` | Prod |
| `A4` | `https://mintsocket.github.io/webgltest/` | Dev (Jay 제작, 백업용 / 우리 레포 아님) |
| `A6` 이하 | 원본 스프레드시트 URL들 | 실제 차단 목록 |

`isBlacklistedSheetId()`가 A2~A4도 스캔하지만, URL 문자열이 시트ID와 일치할 일이
없으므로 무해하다.

→ **CF를 정식 Prod로 승격할 때는 `blacklist!A3`을 CF URL로 교체**하면 G열이 통째로 바뀐다.

---

## 링크 형식 — 경로 방식 아님 (실측)

`handlePlayRequest` 주석은 `.../unity-webgl/[학생시트ID]` 경로 방식으로 적혀 있으나
**실제와 다르다.** 실측 결과:

| URL 형식 | GitHub Pages | CF Pages |
|---|---|---|
| `/unity-webgl/<시트ID>` (주석의 경로 방식) | **404** | — |
| `/?resetPrefs=1&sheetLink=<시트ID>` | **200** ✅ | **200** ✅ |

빌드 문자열 풀에서 확인된 파라미터: `?sheetLink=`(2건), `resetPrefs`(1건),
그리고 스크립트 호출용 `?code=` · `?mode=csv&sheetId=` · `?mode=play&sheetId=`.

### ⚠️ CF에서 경로 방식을 쓰면 안 되는 이유

`docs/index.html`의 `getBasePath()`는 **첫 경로 조각을 base로 삼는다.**

```js
if (parts.length === 0) return "/";
return "/" + parts[0] + "/";
```

- CF 루트 `/` → parts 없음 → base `/` → `/Build/...` 정상 ✅
- CF `/<시트ID>` → parts[0]이 시트ID → base `/<시트ID>/` → **로더를 엉뚱한 곳에서 찾음** ❌

게다가 CF는 없는 경로에 **404가 아니라 index.html을 200으로** 돌려주므로,
`/<시트ID>/Build/loader.js` 요청이 HTML(3,548 B)을 받아 **조용히 깨진다**
(정상 로더는 26,982 B). 반드시 쿼리스트링 형식을 쓸 것.

---

## 검증 기록 (2026-08-15)

```
https://mazm-unity-webgl.pages.dev/?resetPrefs=1&sheetLink=<시트ID>
  → 200, index.html 3,548 B
https://mazm-unity-webgl.pages.dev/Build/MazM_Studio_WebGL.loader.js
  → 200, 26,982 B (실제 JS)
```

기존 Prod 링크와 응답 형태 동일. 빌드가 `sheetLink`·`resetPrefs`를 모두 인식.
