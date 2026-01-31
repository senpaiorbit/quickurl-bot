// /api/upload.js

const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";
const DEVUPLOADS_API_KEY = "1240962gatdo40wtrx6qce";

const GOFILE_TOKEN = "EDlLlbUnWv00p78YoEetu2ziisd4wkRW";
const GOFILE_FOLDER_ID = "9fff4533-7a87-405d-a20a-f75c938ff904";

const CACHE_TTL = 10 * 60 * 1000;
const cache = global.uploadCache || new Map();
global.uploadCache = cache;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { url, filename } = req.query;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: "Valid ?url= required" });
  }

  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.time < CACHE_TTL) {
    return res.json({ ok: true, cached: true, servers: cached.servers });
  }

  const servers = {};
  const fileName = filename || `file_${Date.now()}`;

  // ================= FETCH FILE ONCE =================
  let buffer;
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) throw new Error("Fetch failed");
    buffer = Buffer.from(await r.arrayBuffer());
  } catch {
    return res.status(400).json({
      ok: false,
      error: "Source URL blocked server-side download"
    });
  }

  // ================= PIXELDRAIN =================
  try {
    const form = new FormData();
    form.append("file", new Blob([buffer]), fileName);

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
  } catch {}

  // ================= DEVUPLOADS (REMOTE UPLOAD) =================
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
  } catch {}

  // ================= GOFILE (TOKEN + FOLDER) =================
  try {
    const serverRes = await fetch(
      `https://api.gofile.io/getServer?token=${GOFILE_TOKEN}`
    ).then(r => r.json());

    if (serverRes?.status === "ok") {
      const form = new FormData();
      form.append("file", new Blob([buffer]), fileName);
      form.append("token", GOFILE_TOKEN);
      form.append("folderId", GOFILE_FOLDER_ID);

      const r = await fetch(
        `https://${serverRes.data.server}.gofile.io/uploadFile`,
        { method: "POST", body: form }
      ).then(r => r.json());

      if (r?.status === "ok") {
        servers.gofile = r.data.downloadPage;
      }
    }
  } catch {}

  // ================= FINAL VALIDATION =================
  if (Object.keys(servers).length === 0) {
    return res.status(502).json({
      ok: false,
      error: "All providers failed",
      reason: "File host blocks server-side access or size limit exceeded"
    });
  }

  cache.set(url, { time: now, servers });

  return res.json({
    ok: true,
    cached: false,
    servers
  });
}
