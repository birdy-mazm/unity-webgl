# gas-proxy (Cloudflare Worker)

Apps Script 웹앱 앞단 프록시. CSV 내보내기(gviz)와 로그인 시트 검증을 Worker에서 먼저 처리하고, 실패하면 Apps Script로 넘긴다. 현재 버전: **v3.1** (`gas-proxy.js`).

## 주소
- `https://gas.mazm.dev/exec` (GET만 허용, 경로는 `/exec` 고정)

## 배포
1. Cloudflare 대시보드 → Workers & Pages → `gas-proxy`
2. **Edit code** → `worker/gas-proxy.js` 내용 전체를 붙여넣기
3. **Deploy**

레포의 `worker/gas-proxy.js`가 정본이다. 대시보드에서 직접 고치지 말고 레포를 먼저 수정한다.

## 롤백
CF 대시보드 → `gas-proxy` → **Deployments** → 이전 버전 선택 → 롤백.
Worker 자체를 우회해야 할 때는 `.planning/cf-migration.md`의 "Worker 우회(비상) 절차"를 따른다.

## Apps Script 대응 버전
- Apps Script 배포 버전: **14**
- 코드 태그: **worker-validate-v1** (`skipValidate=1` 파라미터를 받아 시트 구조 검증을 건너뜀)

Worker v3.1은 Apps Script 버전 14 이상과 짝이다. Apps Script를 그보다 낮은 버전으로 되돌리면 `skipValidate`가 무시되어 검증이 Apps Script에서 다시 수행된다(동작은 유지, 속도만 느려짐).

## 응답 헤더
| 헤더 | 값 | 의미 |
|---|---|---|
| `X-Csv-Source` | `gviz` \| `gas` | CSV 요청(`mode=csv`)을 Worker가 gviz 내보내기로 직접 응답했는지(`gviz`), gviz 실패로 Apps Script를 거쳤는지(`gas`) |
| `X-Validate` | `worker` \| `gas` | 로그인 요청의 시트 구조 검증 주체. `worker`면 Worker가 통과시켜 `skipValidate=1`을 붙여 보냄, `gas`면 Apps Script가 검증 |
| `X-Gas-Attempts` | 숫자 | Apps Script 경로에서 응답을 준 시도 번호 |
| `X-Gas-Hedged` | `1` \| `0` | 첫 요청이 지연되어 헤지(두 번째 동시 요청)를 발사했는지 여부 |

`X-Csv-Source: gviz`인 응답에는 `X-Gas-*` 헤더가 붙지 않는다(Apps Script 미호출).
