// /api/upload.js

const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";
const DEVUPLOADS_API_KEY = "1240962gatdo40wtrx6qce";

const CACHE_TTL = 10 * 60 * 1000;

// global cache (serverless-safe best effort)
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

  // ================= SAFE CACHE READ =================
  const cached = uploadCache.get(cacheKey);
  if (cached && now - cached.time < CACHE_TTL) {
    // ❗ ignore broken cache
    if (Object.keys(cached.servers).length > 0) {
      return res.status(200).json({
        ok: true,
        cached: true,
        servers: cached.servers
      });
    } else {
      uploadCache.delete(cacheKey);
    }
  }

  const servers = {};
  const fileName = filename || `file_${Date.now()}`;

  // ================= PIXELDRAIN =================
  try {
    const fileRes = await fetch(url);
    if (fileRes.ok) {
      const blob = await fileRes.blob();
      const form = new FormData();
      form.append("file", blob, fileName);

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
    }
  } catch (_) {}

  // ================= DEVUPLOADS =================
  try {
    const s = await fetch(
      `https://devuploads.com/api/upload/server?key=${DEVUPLOADS_API_KEY}`
    ).then(r => r.json());

    if (s?.result) {
      const r = await fetch(`${s.result}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

  // ================= GOFILE (3 SERVERS) =================
  try {
    const gofileStores = ["store1", "store2", "store3"];
    for (const s of gofileStores) {
      const r = await fetch(`https://${s}.gofile.io/uploadFile`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url })
      }).then(r => r.json());

      if (r?.status === "ok" && r?.data?.downloadPage) {
        servers.gofile = r.data.downloadPage;
        break;
      }
    }
  } catch (_) {}

  // ================= CACHE ONLY IF VALID =================
  if (Object.keys(servers).length > 0) {
    uploadCache.set(cacheKey, {
      time: now,
      servers
    });
  }

  return res.status(200).json({
    ok: true,
    cached: false,
    servers
  });
}
