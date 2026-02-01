export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Missing ?url parameter"
    });
  }

  const GOFILE_TOKEN = process.env.GOFILE_TOKEN;

  if (!GOFILE_TOKEN) {
    return res.status(500).json({
      success: false,
      error: "GOFILE_TOKEN not set"
    });
  }

  try {
    const formBody = new URLSearchParams();
    formBody.append("token", GOFILE_TOKEN);
    formBody.append("url", url);

    const response = await fetch("https://api.gofile.io/uploadByUrl", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formBody.toString()
    });

    const text = await response.text();

    // 🔍 SAFETY CHECK (important)
    if (!text.startsWith("{")) {
      return res.status(502).json({
        success: false,
        error: "GoFile returned non-JSON",
        raw: text.slice(0, 200)
      });
    }

    const data = JSON.parse(text);

    if (data.status !== "ok") {
      return res.status(500).json({
        success: false,
        error: "GoFile upload failed",
        gofile: data
      });
    }

    return res.status(200).json({
      success: true,
      downloadPage: data.data.downloadPage,
      fileId: data.data.fileId
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: err.message
    });
  }
}
