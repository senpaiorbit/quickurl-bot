export default {
  async fetch(request) {
    const BOT_TOKEN = "8214031086:AAEDlY1VVTTv-FklSHl0sgFmi_k-T1IQbbs";
    const PUBLIC_CHANNEL = "@quickURL_files";

    const GOFILE_TOKEN = "EDlLlbUnWv00p78YoEetu2ziisd4wkRW";
    const PIXELDRAIN_API_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";

    if (request.method !== "POST") {
      return new Response("OK");
    }

    const update = await request.json();
    if (!update.message) return new Response("No message");

    const message = update.message;
    const chatId = message.chat.id;
    const msgId = message.message_id;
    const text = message.text || "";

    const tgApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    /* ---------------- START COMMAND ---------------- */
    if (text.startsWith("/start")) {
      await sendMessage(BOT_TOKEN, chatId,
        "👋 Welcome to QuickURL Bot\n\n" +
        "📤 Send any file\n" +
        "🪞 Mirror: GoFile (primary) + Pixeldrain (backup)\n" +
        "⚡ Powered by @quickURL_files"
      );
      return new Response("start ok");
    }

    /* ---------------- FILE CHECK ---------------- */
    const fileObj =
      message.document ||
      message.video ||
      message.audio ||
      (message.photo && message.photo.at(-1));

    if (!fileObj) {
      await sendMessage(BOT_TOKEN, chatId, "❗ Please send a file.");
      return new Response("no file");
    }

    const fileId = fileObj.file_id;
    const fileName = fileObj.file_name || `file_${Date.now()}`;

    /* ---------------- GET FILE PATH ---------------- */
    const filePathRes = await fetch(`${tgApi}/getFile?file_id=${fileId}`);
    const filePathData = await filePathRes.json();

    if (!filePathData.ok) {
      await sendMessage(BOT_TOKEN, chatId, "❌ Failed to fetch file info.");
      return new Response("getFile failed");
    }

    const filePath = filePathData.result.file_path;
    const tgFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    /* ---------------- STREAM FROM TELEGRAM ---------------- */
    const tgFileRes = await fetch(tgFileUrl);
    if (!tgFileRes.ok) {
      await sendMessage(BOT_TOKEN, chatId, "❌ File download failed.");
      return new Response("tg download failed");
    }

    const fileStream = tgFileRes.body;

    let mirrorLink = "";
    let mirrorSource = "";

    /* ================= GOFILE (PRIMARY) ================= */
    try {
      const gofileForm = new FormData();
      gofileForm.append("token", GOFILE_TOKEN);
      gofileForm.append("file", fileStream, fileName);

      const gofileRes = await fetch("https://upload.gofile.io/uploadfile", {
        method: "POST",
        body: gofileForm
      });

      const gofileData = await gofileRes.json();

      if (gofileData.status === "ok") {
        mirrorLink = gofileData.data.downloadPage;
        mirrorSource = "GoFile";
      }
    } catch (e) {
      console.log("GoFile failed");
    }

    /* ================= PIXELDRAIN (FALLBACK) ================= */
    if (!mirrorLink) {
      try {
        const pdForm = new FormData();
        pdForm.append("file", fileStream, fileName);

        const pdRes = await fetch("https://pixeldrain.com/api/file", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`:${PIXELDRAIN_API_KEY}`)}`
          },
          body: pdForm
        });

        const pdData = await pdRes.json();

        if (pdData.success && pdData.id) {
          mirrorLink = `https://pixeldrain.com/u/${pdData.id}`;
          mirrorSource = "Pixeldrain";
        }
      } catch (e) {
        console.log("Pixeldrain failed");
      }
    }

    /* ---------------- COPY TO CHANNEL ---------------- */
    const copyRes = await fetch(`${tgApi}/copyMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PUBLIC_CHANNEL,
        from_chat_id: chatId,
        message_id: msgId
      })
    });

    const copyData = await copyRes.json();
    if (!copyData.ok) {
      await sendMessage(BOT_TOKEN, chatId, "❌ Channel upload failed.");
      return new Response("copy failed");
    }

    const channelMsgId = copyData.result.message_id;
    const channelUsername = PUBLIC_CHANNEL.replace("@", "");
    const tgPublicUrl = `https://t.me/${channelUsername}/${channelMsgId}`;

    /* ---------------- FINAL MESSAGE ---------------- */
    let reply =
      "✅ Upload Successful\n\n" +
      `🔗 Telegram Link:\n${tgPublicUrl}\n\n`;

    if (mirrorLink) {
      reply += `🪞 Mirror (${mirrorSource}):\n${mirrorLink}\n\n`;
    } else {
      reply += "⚠️ Mirror failed (file too large or rate-limited)\n\n";
    }

    reply += "📢 @quickURL_files";

    await sendMessage(BOT_TOKEN, chatId, reply);
    return new Response("done");
  }
};

/* ================= HELPERS ================= */

async function sendMessage(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });
}
