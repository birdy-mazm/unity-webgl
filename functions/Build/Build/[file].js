const R2_FILES = new Set([
  "Build.data",
  "Build.wasm",
]);

export async function onRequestGet({ request, params, env, waitUntil, next }) {
  if (!R2_FILES.has(params.file)) return next(); // .js 등은 Pages 정적 파일로 통과

  // 엣지 캐시 키 = 요청 URL(쿼리 포함). ?v= 값이 바뀌면 새 캐시 항목이 된다.
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // R2 키는 쿼리를 무시하고 파일명만 본다.
  const obj = await env.WEBGL_ASSETS.get("v3/" + params.file);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (params.file.endsWith(".wasm")) {
    headers.set("Content-Type", "application/wasm"); // 미설정 시 로딩 저하
  }
  const response = new Response(obj.body, { headers });
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
