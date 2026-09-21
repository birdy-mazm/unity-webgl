// gas-proxy v3.1 — CSV 내보내기 경로 + 로그인 시트 검증을 Worker에서 수행
//
// v3.0 → v3.1
// - 로그인(code+sheetId): Worker가 gviz로 stage/npc/dialog 헤더를 동시에 검증.
//   통과하면 Apps Script에 skipValidate=1 을 붙여 보낸다 (Apps Script는 코드 확인+매핑만).
//   검증 실패·내보내기 실패면 파라미터 없이 보내 Apps Script가 예전처럼 검증한다.
// - 응답 헤더 X-Validate: worker | gas

const GAS_BASE =
  "https://script.google.com/macros/s/AKfycbxk1zsu1C9DBXse53CKws3nmdboVlH6Wl6UY6AvRT1fUsjo-VDvjyhNyLFIBHL7SYNC/exec";

const BUDGET_MS = 15000;
const HEDGE_AFTER_CSV_MS = 5000;
const HEDGE_AFTER_AUTH_MS = 8000;
const EARLY_RETRY_DELAY_MS = 300;
const NO_RETRY_STATUS = new Set([400, 401, 403]);
const LOG_TIMEOUT_MS = 20000;

const GVIZ_TIMEOUT_MS = 6000;
const SHEET_ID_RE = /^[a-zA-Z0-9-_]{20,}$/;

// CSV 탭 → 헤더에 반드시 있어야 할 열(소문자). Apps Script의 REQUIRED_TABS와 동일하게 유지.
const REQUIRED_TABS = {
  stage: ["idx", "stagename", "mapname", "bgm", "quest", "player", "main_npc"],
  npc: ["key", "name", "model", "portrait", "posx", "posy", "direction", "interaction"],
  dialog: ["key", "linetype", "talker", "desc"],
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "X-Gas-Attempts, X-Gas-Hedged, X-Csv-Source, X-Validate",
  };
}

function textResponse(body, status, extra) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(extra || {}),
    },
  });
}

function maskQuery(search) {
  return search.replace(/code=[^&]*/g, "code=***");
}

function looksLikeHtml(body) {
  return /^\s*<(!doctype|html)/i.test(body.slice(0, 200));
}

// ---------- CSV 파서/직렬화 (Apps Script valuesToCsv와 동일 규칙) ----------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function escapeCsvCell(value) {
  value = String(value == null ? "" : value);
  if (value.indexOf('"') >= 0 || value.indexOf(",") >= 0 || value.indexOf("\n") >= 0 || value.indexOf("\r") >= 0) {
    value = '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function rowsToCsv(rows) {
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
}

function normalizeHeader(v) {
  return String(v || "").trim().replace(/\uFEFF/g, "").toLowerCase();
}

// ---------- 내보내기(gviz) ----------

async function fetchGvizRows(sheetId, tab) {
  const target = "https://docs.google.com/spreadsheets/d/" + sheetId +
    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(tab);
  const res = await fetch(target, {
    redirect: "follow",
    signal: AbortSignal.timeout(GVIZ_TIMEOUT_MS),
    headers: { "User-Agent": "gas-proxy/3.1 gviz" },
  });
  if (!res.ok) throw new Error("gviz HTTP " + res.status);
  const ct = res.headers.get("content-type") || "";
  if (ct.indexOf("text/html") >= 0) throw new Error("gviz html");
  const text = await res.text();
  if (looksLikeHtml(text)) throw new Error("gviz html-body");
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("gviz empty");
  return rows;
}

// 헤더에 필수 열이 모두 있고 2행에 데이터가 있는지. 실패 사유 문자열 반환, 통과면 null.
function checkStructure(rows, tab) {
  const header = rows[0].map(normalizeHeader);
  for (const h of REQUIRED_TABS[tab]) {
    if (header.indexOf(h) < 0) return "Missing header '" + h + "' in tab: " + tab;
  }
  const second = rows[1] || [];
  if (!second.some((v) => String(v || "").trim() !== "")) return "No data rows in tab: " + tab;
  return null;
}

async function fetchCsvViaGviz(sheetId, tab) {
  const rows = await fetchGvizRows(sheetId, tab);
  const header = rows[0].map(normalizeHeader);
  if (header.indexOf(REQUIRED_TABS[tab][0]) < 0) throw new Error("gviz header-mismatch");
  return rowsToCsv(rows);
}

// 로그인용 구조 검증: 3탭 동시 읽기. 통과 → true, 구조 문제 → false, 내보내기 자체 실패 → throw
async function validateViaGviz(sheetId) {
  const tabs = Object.keys(REQUIRED_TABS);
  const results = await Promise.all(tabs.map((tab) => fetchGvizRows(sheetId, tab)));
  for (let i = 0; i < tabs.length; i++) {
    const problem = checkStructure(results[i], tabs[i]);
    if (problem) return false;
  }
  return true;
}

// ---------- Apps Script 경로 ----------

async function callGas(target, signal) {
  const res = await fetch(target, {
    redirect: "follow",
    signal,
    headers: { "User-Agent": "gas-proxy/3.1" },
  });
  if (!res.ok) throw Object.assign(new Error("HTTP " + res.status), { status: res.status });
  const body = await res.text();
  if (looksLikeHtml(body)) throw new Error("google-error-page");
  if (body.startsWith("ERROR:")) throw Object.assign(new Error("gas-error"), { softBody: body });
  return body;
}

async function callGasHedged(target, hedgeAfterMs) {
  const deadline = AbortSignal.timeout(BUDGET_MS);
  const controllers = [];
  const timers = [];
  let done = false;
  let noRetry = false;
  let hedged = false;

  const attempt = (n) => {
    const ctl = new AbortController();
    controllers.push(ctl);
    const signal = AbortSignal.any([ctl.signal, deadline]);
    return callGas(target, signal).then((body) => { done = true; return { body, n }; });
  };

  let fireHedge;
  const hedgeSignal = new Promise((r) => (fireHedge = r));
  timers.push(setTimeout(fireHedge, hedgeAfterMs));

  const first = attempt(1).catch((err) => {
    if (err && err.status && NO_RETRY_STATUS.has(err.status)) noRetry = true;
    else timers.push(setTimeout(fireHedge, EARLY_RETRY_DELAY_MS));
    throw err;
  });

  const second = hedgeSignal.then(() => {
    if (done || noRetry) return Promise.reject(new Error("hedge-skipped"));
    hedged = true;
    return attempt(2);
  });

  const finish = () => {
    timers.forEach((tm) => clearTimeout(tm));
    controllers.forEach((c) => c.abort());
  };

  try {
    const winner = await Promise.any([first, second]);
    finish();
    return { ok: true, body: winner.body, attempts: winner.n, hedged };
  } catch (err) {
    finish();
    const errors = (err && err.errors ? err.errors : [err]);
    const soft = errors.find((e) => e && e.softBody);
    if (soft) return { ok: true, body: soft.softBody, attempts: 0, hedged, soft: true };
    const reasons = errors
      .map((e) => (e && e.name === "TimeoutError") ? "timeout" : String(e && e.message || e))
      .filter((m) => m !== "hedge-skipped");
    return { ok: false, reasons, hedged };
  }
}

async function logRefreshInBackground(sheetId, t) {
  const target = GAS_BASE + "?mode=log&sheetId=" + encodeURIComponent(sheetId) +
    (t ? "&t=" + encodeURIComponent(t) : "");
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(LOG_TIMEOUT_MS),
      headers: { "User-Agent": "gas-proxy/3.1 log" },
    });
    if (!res.ok) console.warn("gas-proxy log failed: HTTP " + res.status);
  } catch (err) {
    console.warn("gas-proxy log failed: " + String(err && err.message || err));
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== "GET") return textResponse("ERROR: method not allowed", 405);
    if (url.pathname !== "/exec") return textResponse("ERROR: not found", 404);

    const mode = url.searchParams.get("mode") || "";
    const tab = url.searchParams.get("tab") || "";
    const sheetId = url.searchParams.get("sheetId") || "";
    const code = url.searchParams.get("code") || "";
    const t = url.searchParams.get("t") || "";
    const isCsv = mode === "csv";
    const isStage = isCsv && tab === "stage";
    const isAuth = !mode && !!code && SHEET_ID_RE.test(sheetId);

    // ---- 1) CSV: 내보내기 경로 먼저 ----
    if (isCsv && REQUIRED_TABS[tab] && SHEET_ID_RE.test(sheetId)) {
      try {
        const csv = await fetchCsvViaGviz(sheetId, tab);
        if (isStage) ctx.waitUntil(logRefreshInBackground(sheetId, t));
        return textResponse(csv, 200, { "X-Csv-Source": "gviz" });
      } catch (err) {
        console.warn("gas-proxy gviz fallback: " + String(err && err.message || err) + " tab=" + tab);
      }
    }

    // ---- 2) 로그인: Worker가 시트 구조를 먼저 검증 ----
    let validatedBy = "gas";
    let extraQuery = "";
    if (isAuth) {
      try {
        const ok = await validateViaGviz(sheetId);
        if (ok) { validatedBy = "worker"; extraQuery = "&skipValidate=1"; }
        // 구조 문제면 파라미터 없이 보내 Apps Script가 코드 확인 → 구조 검증 순서로 문구를 낸다
      } catch (err) {
        console.warn("gas-proxy validate fallback: " + String(err && err.message || err));
      }
    }

    // ---- 3) Apps Script 경로 ----
    const target = GAS_BASE + url.search + (isStage ? "&nolog=1" : "") + extraQuery;
    const hedgeAfterMs = isCsv ? HEDGE_AFTER_CSV_MS : HEDGE_AFTER_AUTH_MS;
    const r = await callGasHedged(target, hedgeAfterMs);

    if (r.ok) {
      if (isStage && !r.soft && !r.body.startsWith("FAIL:")) {
        ctx.waitUntil(logRefreshInBackground(sheetId, t));
      }
      const headers = {
        "X-Gas-Attempts": String(r.attempts),
        "X-Gas-Hedged": r.hedged ? "1" : "0",
      };
      if (isCsv) headers["X-Csv-Source"] = "gas";
      if (isAuth) headers["X-Validate"] = validatedBy;
      return textResponse(r.body, 200, headers);
    }

    console.warn("gas-proxy failed: " + r.reasons.join(" | ") + " " + maskQuery(url.search));
    return textResponse("ERROR: gas-proxy upstream failed: " + r.reasons.join(" | "), 502);
  },
};
