export default {
  async fetch(request) {
    const BOT_TOKEN = "8214031086:AAEDlY1VVTTv-FklSHl0sgFmi_k-T1IQbbs";
    const PUBLIC_CHANNEL = "@quickURL_files";

    if (request.method !== "POST") {
      return new Response("OK");
    }

    const update = await request.json();
    if (!update.message) return new Response("No message");

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || "";

    // /start command
    if (text.startsWith("/start")) {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "👋 *Welcome to QuickURL Bot*\n\n" +
        "📤 Send or forward any file\n" +
        "🔗 Get instant public Telegram link\n\n" +
        "⚡ Powered by @quickURL_files",
        "Markdown"
      );
      return new Response("OK");
    }

    // Detect file
    let file, fileType;
    if (message.document) {
      file = message.document;
      fileType = "document";
    } else if (message.video) {
      file = message.video;
      fileType = "video";
    } else if (message.photo) {
      file = message.photo[message.photo.length - 1];
      fileType = "photo";
    } else {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "❗ Please send a file (document, video, or image)."
      );
      return new Response("No file");
    }

    const username = message.from.username
      ? `@${message.from.username}`
      : "Anonymous";

    const fileName = file.file_name || "Image";
    const fileSizeMB = file.file_size
      ? (file.file_size / 1024 / 1024).toFixed(2) + " MB"
      : "Unknown";

    const time = new Date(message.date * 1000).toLocaleString();

    const caption =
      `📦 *TITLE:* ${fileName}\n\n` +
      `👤 *Upload by:* ${username}\n` +
      `📁 *Size:* ${fileSizeMB}\n` +
      `⏰ *Time:* ${time}\n\n` +
      `🤖 *Checkout bot:* @QuickURL_roBot\n` +
      `📮 *Join:* ${PUBLIC_CHANNEL}`;

    const tgApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    // Send file with custom caption
    const method =
      fileType === "document"
        ? "sendDocument"
        : fileType === "video"
        ? "sendVideo"
        : "sendPhoto";

    const res = await fetch(`${tgApi}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PUBLIC_CHANNEL,
        [fileType]: file.file_id,
        caption,
        parse_mode: "Markdown"
      })
    });

    const data = await res.json();
    if (!data.ok) {
      await sendMessage(BOT_TOKEN, chatId, "❌ Upload failed.");
      return new Response("Fail");
    }

    const channelMsgId = data.result.message_id;
    const channelUsername = PUBLIC_CHANNEL.replace("@", "");
    const publicUrl = `https://t.me/${channelUsername}/${channelMsgId}`;

    // Reply to user
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "✅ *Uploaded Successfully*\n\n" +
      `🔗 *File Link:*\n${publicUrl}\n\n` +
      `🔗 *Easy Copy:*\n${publicUrl}\n\n` +
      "📮 Join @quickURL_files",
      "Markdown"
    );

    return new Response("Done");
  }
};

async function sendMessage(botToken, chatId, text, mode) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: mode || undefined,
      disable_web_page_preview: true
    })
  });
}
