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
      error: "Server misconfiguration: token missing"
    });
  }

  try {
    const apiUrl = "https://api.gofile.io/uploadByUrl";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: GOFILE_TOKEN,
        url: url
      })
    });

    const data = await response.json();

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
