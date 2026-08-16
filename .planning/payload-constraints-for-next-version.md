# 초기 로딩 용량 — 현행 실측과 신규 버전 제약 요건

> 작성일: 2026-08-15
> 작성 배경: 현 WebGL 빌드를 Cloudflare로 이전하며 대역폭 병목은 해소했으나,
> **첫 로딩 용량 112MB**는 그대로 남아 있음을 확인함.
> 이 문서는 신규 웹 스튜디오 프로젝트에 **제약 요건**으로 이관하기 위해 작성됨.
>
> 대상 빌드: `MazM_Studio` / Unity `6000.3.10f1` / `birdy-mazm/unity-webgl` @ `a97feec (Prod 2.8)`

---

## 1. 한 줄 요약

**초기 로딩 112MB는 웹 플랫폼의 제약이 아니라 Unity WebGL의 패키징 선택 결과다.**
신규 버전이 "웹으로 다시 만든다"는 것만으로는 해결되지 않으며, **로딩 목표치를 숫자로
못박지 않으면 동일한 문제가 재발한다.**

---

## 2. 현행 실측

### 전송량 구성 (첫 방문 1회 기준)

| 파일 | 크기 | 내용 |
|---|---|---|
| `MazM_Studio_WebGL.data` | 88,042,055 B (84.0 MiB) | 에셋 아카이브 |
| `MazM_Studio_WebGL.wasm` | 29,266,930 B (27.9 MiB) | 엔진 런타임 + 컴파일된 게임 코드 |
| `MazM_Studio_WebGL.framework.js` | 414,939 B | 글루 코드 |
| `MazM_Studio_WebGL.loader.js` | 26,982 B | 로더 |
| **합계** | **약 112 MB** | 압축 미적용 상태로 전송 중 |

### `.data` 84MB의 내부 구성

| 항목 | 크기 | 비중 | 성격 |
|---|---|---|---|
| `resources.resource` | 50,481,655 B | **57.3%** | Unity **`Resources/` 폴더** 일괄 포함분 |
| `data.unity3d` | 30,489,042 B | 34.6% | 씬 + 참조 에셋 |
| `Il2CppData/Metadata/global-metadata.dat` | 5,429,988 B | 6.2% | IL2CPP 메타데이터 |
| `Resources/unity default resources` | 1,632,004 B | 1.9% | Unity 기본 리소스 |
| 기타 (json, boot.config) | 9,096 B | 0.0% | |

---

## 3. 원인 분석 — 셋 다 해결 가능한 항목이다

### ① `Resources/` 폴더 일괄 포함 — 50MB (전체의 45%)

Unity에서 `Resources/` 폴더에 넣은 에셋은 **실제 사용 여부와 무관하게 전부 빌드에
포함되며, 스트리밍·지연 로딩이 불가능하다.** 1개 챕터만 플레이해도 전체 작품의
에셋을 모두 내려받는 구조가 된다.

Unity 공식 문서가 웹 빌드에서 **명시적으로 피하라고 권고**하는 패턴이다.
→ Addressables / AssetBundle로 전환 시 챕터 단위 스트리밍 가능.

### ② 압축 미적용 — 약 20MB 낭비

`.wasm` 28MB는 brotli 적용 시 **7.7MB**로 줄어든다 (사전 압축 테스트 결과).
현재는 무압축 전송 중이며, 이는 **서버·빌드 설정만으로 해소 가능**하다.

`.data`는 에셋이 이미 압축 형식이라 brotli로도 74.6MB에 그쳐 실익이 없다.
→ `.data` 문제는 압축이 아니라 **①의 스트리밍 전환**으로 풀어야 한다.

### ③ Unity 엔진 런타임 자체 — 축소 불가

Unity를 사용하는 한 런타임 무게는 줄일 수 없다. 웹 게임 엔진 중 가장 무거운 축이며,
웹 네이티브 라이브러리(PixiJS, Phaser 등)는 0.1~1MB 수준이다.

---

## 4. 왜 제약 요건이어야 하는가

### 시나리오 A — 교실 (30명 동시 접속)

| 초기 로딩 | 30명 총 전송량 | 학교 회선 100Mbps 기준 이론 최소 시간 |
|---|---|---|
| **현행 112MB** | 3,360 MB | **약 4.5분** (실제로는 10분 이상) |
| 15MB | 450 MB | 약 36초 |
| 5MB | 150 MB | **약 12초** |

수업 시작 직후 전원이 동시에 접속하는 패턴이므로 회선을 공유한다.
브라우저 캐시(1시간)는 **첫 접속에 도움이 되지 않는다.**

### 시나리오 B — 마케팅 / 외부 공유

| 회선 | 현행 112MB 로딩 시간 |
|---|---|
| 광랜 100Mbps | 약 10초 |
| 일반 20Mbps | 약 45초 |
| 모바일 LTE | **약 90초 + 사용자 데이터 112MB 소모** |

맥락 없이 유입된 방문자는 로딩 중 대부분 이탈한다. 모바일은 데이터 소모 부담까지
겹쳐 사실상 사용 불가에 가깝다.

---

## 5. 신규 버전 제약 요건

### R1. 초기 로딩 목표 (필수)

> **첫 플레이 가능 상태까지 도달하는 데 필요한 전송량을 제한한다.**

| 등급 | 전송량 | 20Mbps 기준 시간 | 판정 |
|---|---|---|---|
| **목표** | **≤ 5 MB** | ≤ 3초 | 권장 |
| **상한** | **≤ 15 MB** | ≤ 8초 | 허용 최대 |
| 초과 | > 15 MB | — | **반려** |

**측정 조건**: 캐시 없는 최초 방문, 압축 적용 후 실제 네트워크 전송량(transferred),
"첫 플레이 가능"은 첫 대사가 조작 가능한 상태로 표시된 시점.

> ⚠️ **이 숫자는 기술 선택을 결정한다.**
> 목표 5MB → Unity WebGL은 사실상 배제된다 (brotli 압축 wasm만으로도 7.7MB).
> 상한 15MB → Unity WebGL도 가능하나 **Addressables + brotli가 필수 전제**다.
> 어느 쪽을 택할지는 의사결정 사항이며, 이 문서는 **결정하지 않은 채 넘어가는 것을
> 막기 위한 것**이다.

### R2. 에셋 스트리밍 (필수)

- 전체 작품 에셋을 초기에 일괄 로딩하지 않는다
- **챕터 또는 씬 단위로 필요 시점에 로딩**한다
- Unity 채택 시: `Resources/` 폴더 사용 금지, Addressables 사용

### R3. 압축 (필수)

- 코드·텍스트 자산은 brotli 압축 후 전송 (`Content-Encoding: br`)
- 이미지는 WebP/AVIF 등 웹 최적 포맷 사용
- 이미 압축된 형식(오디오, 압축 텍스처)에 이중 압축을 적용하지 않는다

### R4. 모바일 지원 (필수)

- 모바일 브라우저에서 동작하고, 초기 로딩이 R1 기준을 만족할 것
- 마케팅·외부 공유 유입의 상당수가 모바일이다

### R5. 측정 가능성 (필수)

- R1 수치를 **개발 중 상시 확인 가능한 형태**로 계측한다
  (예: 빌드 산출물 크기 리포트, Lighthouse, DevTools Network transferred)
- 최종 검수 시 위 측정 조건으로 재현 검증한다

---

## 6. 기술 선택별 예상치 (참고)

| 선택 | 초기 로딩 예상 | R1 판정 |
|---|---|---|
| Unity WebGL — 현행 방식 유지 | 112 MB | ❌ 반려 |
| Unity WebGL + brotli만 적용 | 약 92 MB | ❌ 반려 |
| Unity WebGL + brotli + Addressables | 15~30 MB | △ 상한 경계 |
| 웹 네이티브 (JS/Canvas/WebGL 라이브러리) | 1~3 MB | ✅ 목표 충족 |

### 콘텐츠 성격 참고

현행 데이터 모델은 `stage` / `npc` / `dialog` 3개 탭 + Spine 애니메이션 + 포트레이트로,
**비주얼 노벨 / 어드벤처 장르**에 해당한다. 3D 렌더링, 물리 연산, 실시간 시뮬레이션이
없다. 이 장르는 웹 네이티브 스택과 적합도가 높으며, Unity 채택 시 28MB 런타임이
기능적 이득 없이 비용으로만 남는다.

---

## 7. 부록 — 측정 재현 방법

`.data` 내부 구성은 UnityWebData 아카이브 헤더를 파싱해 확인했다.

```python
import struct
d = open("MazM_Studio_WebGL.data", 'rb').read(1_000_000)
magic = b"UnityWebData1.0\x00"
p = len(magic)
hdr, = struct.unpack_from('<I', d, p); p += 4
while p < hdr:
    off, = struct.unpack_from('<I', d, p); p += 4
    sz,  = struct.unpack_from('<I', d, p); p += 4
    nl,  = struct.unpack_from('<I', d, p); p += 4
    name = d[p:p+nl].decode('utf-8', 'replace'); p += nl
    print(f"{sz:>12,}  {name}")
```

전송량 측정:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download} %{content_type}\n' \
  https://mazm-unity-webgl.pages.dev/Build/MazM_Studio_WebGL.data
```

---

## 8. 관련 문서

- `cf-migration.md` — Cloudflare 이전 기록, 용량·한도 분석
- `apps-script-play-links.md` — 플레이 링크 구조
- `cf_이전_실행브리프.md` — 이전 작업 원본 브리프
