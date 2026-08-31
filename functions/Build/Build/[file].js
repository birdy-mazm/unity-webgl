const R2_FILES = new Set([
  "Build.data",
  "Build.wasm",
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
