export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url || !/^https?:\/\//i.test(url)) {
      return json({
        ok: false,
        error: "Valid ?url= parameter required"
      }, 400);
    }

    const servers = {};

    /* ================= PIXELDRAIN (REMOTE) ================= */
    try {
      const r = await fetch("https://pixeldrain.com/api/remote", {
        method: "POST",
        headers: {
          "Authorization":
            "Basic " + btoa(":" + "cc3b6605-22c9-4ee6-a826-54bc62621d81"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      }).then(r => r.json());

      if (r?.success && r?.id) {
        servers.pixeldrain = `https://pixeldrain.com/u/${r.id}`;
      }
    } catch {}

    /* ================= DEVUPLOADS (REMOTE) ================= */
    try {
      const s = await fetch(
        "https://devuploads.com/api/upload/server?key=1240962gatdo40wtrx6qce"
      ).then(r => r.json());

      if (s?.result) {
        const r = await fetch(`${s.result}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            key: "1240962gatdo40wtrx6qce",
            url,
            public: "1"
          })
        }).then(r => r.json());

        if (r?.result?.link) {
          servers.devuploads = r.result.link;
        }
      }
    } catch {}

    /* ================= GOFILE (REMOTE UPLOAD) ================= */
    try {
      const r = await fetch("https://api.gofile.io/remoteUpload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: "EDlLlbUnWv00p78YoEetu2ziisd4wkRW",
          folderId: "9fff4533-7a87-405d-a20a-f75c938ff904",
          url
        })
      }).then(r => r.json());

      if (r?.status === "ok") {
        servers.gofile = r.data.downloadPage;
      }
    } catch {}

    /* ================= FINAL ================= */
    if (Object.keys(servers).length === 0) {
      return json({
        ok: false,
        error: "All remote uploads failed",
        reason: "Source host blocks remote fetch or provider rejected URL"
      }, 502);
    }

    return json({
      ok: true,
      servers
    });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
