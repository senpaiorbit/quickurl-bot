export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("OK");
    }

    // ⚠️ Hardcoded token (NOT SAFE for production)
    const BOT_TOKEN = "8214031086:AAEDlY1VVTTv-FklSHl0sgFmi_k-T1IQbbs";
    const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    const update = await request.json();
    if (!update.message) {
      return new Response("NO MESSAGE");
    }

    const chatId = update.message.chat.id;

    // Get file from message
    const file =
      update.message.document ||
      update.message.video ||
      update.message.audio ||
      (update.message.photo
        ? update.message.photo[update.message.photo.length - 1]
        : null);

    if (!file) {
      await sendMessage(API, chatId, "❌ Send a file first");
      return new Response("NO FILE");
    }

    // Get file_path from Telegram
    const fileRes = await fetch(`${API}/getFile?file_id=${file.file_id}`);
    const fileData = await fileRes.json();

    if (!fileData.ok) {
      await sendMessage(API, chatId, "⚠️ Failed to fetch file info");
      return new Response("ERROR");
    }

    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    await sendMessage(API, chatId, `✅ File URL:\n${fileUrl}`);

    return new Response("DONE");
  }
};

async function sendMessage(api, chatId, text) {
  await fetch(`${api}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
}
