// /api/upload.js

const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";
const DEVUPLOADS_API_KEY = "1240962gatdo40wtrx6qce";

const CACHE_TTL = 10 * 60 * 1000;
const uploadCache = global.uploadCache || new Map();
global.uploadCache = uploadCache;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { url, filename } = req.query;

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: "Valid ?url= required" });
  }

  const now = Date.now();
  const cacheKey = url;

  // ===== CACHE CHECK =====
  const cached = uploadCache.get(cacheKey);
  if (cached && now - cached.time < CACHE_TTL) {
    return res.json({ ok: true, cached: true, servers: cached.servers });
  }

  const servers = {};
  const fileName = filename || `file_${Date.now()}`;

  // ===== FETCH FILE ONCE =====
  let fileBuffer;
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) throw new Error("File fetch failed");
    fileBuffer = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: "Source file is not reachable by server"
    });
  }

  // ===== PIXELDRAIN =====
  try {
    const form = new FormData();
    form.append("file", new Blob([fileBuffer]), fileName);

    const r = await fetch("https://pixeldrain.com/api/file", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(":" + PIXELDRAIN_API_KEY).toString("base64")
      },
      body: form
    });

    const j = await r.json();
    if (j?.success && j?.id) {
      servers.pixeldrain = `https://pixeldrain.com/u/${j.id}`;
    }
  } catch (_) {}

  // ===== DEVUPLOADS =====
  try {
    const s = await fetch(
      `https://devuploads.com/api/upload/server?key=${DEVUPLOADS_API_KEY}`
    ).then(r => r.json());

    if (s?.result) {
      const r = await fetch(`${s.result}/upload`, {
        method: "POST",
        body: new URLSearchParams({
          key: DEVUPLOADS_API_KEY,
          url,
          public: "1"
        })
      }).then(r => r.json());

      if (r?.result?.link) {
        servers.devuploads = r.result.link;
      }
    }
  } catch (_) {}

  // ===== GOFILE (CORRECT WAY) =====
  try {
    const s = await fetch("https://api.gofile.io/getServer")
      .then(r => r.json());

    if (s?.status === "ok") {
      const form = new FormData();
      form.append("file", new Blob([fileBuffer]), fileName);

      const r = await fetch(
        `https://${s.data.server}.gofile.io/uploadFile`,
        { method: "POST", body: form }
      ).then(r => r.json());

      if (r?.status === "ok") {
        servers.gofile = r.data.downloadPage;
      }
    }
  } catch (_) {}

  // ===== FINAL VALIDATION =====
  if (Object.keys(servers).length === 0) {
    return res.status(502).json({
      ok: false,
      error: "All upload providers failed",
      hint: "Source URL may block server-side downloads"
    });
  }

  uploadCache.set(cacheKey, { time: now, servers });

  return res.json({
    ok: true,
    cached: false,
    servers
  });
}
