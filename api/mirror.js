export default async function handler(req, res) {
  try {
    const fileUrl = req.query.url;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing ?url parameter"
      });
    }

    // ⚠️ Hardcoded credentials (as requested)
    const GOFILE_ACCOUNT_ID = "9fff4533-7a87-405d-a20a-f75c938ff904";
    const GOFILE_TOKEN = "EDlLlbUnWv00p78YoEetu2ziisd4wkRW";

    // 1️⃣ Get best server
    const serverRes = await fetch("https://api.gofile.io/getServer");
    const serverData = await serverRes.json();

    if (serverData.status !== "ok") {
      throw new Error("Failed to get GoFile server");
    }

    const server = serverData.data.server;

    // 2️⃣ Remote upload (URL → GoFile)
    const uploadRes = await fetch(`https://${server}.gofile.io/uploadFile`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GOFILE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uploadType: "url",
        url: fileUrl,
        accountId: GOFILE_ACCOUNT_ID
      })
    });

    const uploadData = await uploadRes.json();

    if (uploadData.status !== "ok") {
      return res.status(500).json({
        success: false,
        error: uploadData
      });
    }

    // ✅ Success
    return res.status(200).json({
      success: true,
      name: uploadData.data.fileName,
      size: uploadData.data.size,
      downloadPage: uploadData.data.downloadPage,
      directLink: uploadData.data.directLink
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
