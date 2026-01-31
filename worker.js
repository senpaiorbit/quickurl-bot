export default {
  async fetch(request) {
    const BOT_TOKEN = "8214031086:AAEDlY1VVTTv-FklSHl0sgFmi_k-T1IQbbs";
    const PUBLIC_CHANNEL = "@quickURL_files";

    if (request.method !== "POST") {
      return new Response("OK");
    }

    const update = await request.json();

    if (!update.message) {
      return new Response("No message");
    }

    const message = update.message;
    const chatId = message.chat.id;
    const msgId = message.message_id;
    const text = message.text || "";

    // --- /start command ---
    if (text.startsWith("/start")) {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "👋 Welcome to QuickURL Bot\n\n" +
        "📤 Send or forward any file\n" +
        "🔗 I'll generate a public Telegram link instantly\n\n" +
        "⚡ Powered by @quickURL_files"
      );
      return new Response("Start handled");
    }

    // --- Only handle files ---
    const hasFile =
      message.document ||
      message.video ||
      message.audio ||
      message.photo;

    if (!hasFile) {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "❗ Please send or forward a file.\n\n" +
        "✅ Supported: documents, videos, audio, photos."
      );
      return new Response("No file");
    }

    const tgApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    // --- Get file information ---
    let fileInfo = {};
    let fileType = "";
    let fileEmoji = "";

    if (message.document) {
      fileInfo = message.document;
      fileType = "Document";
      fileEmoji = "📄";
    } else if (message.video) {
      fileInfo = message.video;
      fileType = "Video";
      fileEmoji = "🎥";
    } else if (message.audio) {
      fileInfo = message.audio;
      fileType = "Audio";
      fileEmoji = "🎵";
    } else if (message.photo) {
      fileInfo = message.photo[message.photo.length - 1];
      fileType = "Photo";
      fileEmoji = "🖼️";
    }

    const fileName = fileInfo.file_name || fileInfo.file_unique_id || "Unknown";
    const fileSize = formatFileSize(fileInfo.file_size || 0);
    const username = message.from.username ? `@${message.from.username}` : message.from.first_name || "Anonymous";
    const uploadTime = formatTime(message.date);

    // --- First, send the file to channel ---
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
      await sendMessage(BOT_TOKEN, chatId, "❌ Upload failed. Try again.");
      return new Response("Copy failed");
    }

    const channelMsgId = copyData.result.message_id;

    // --- Now send the caption as a separate message ---
    const channelUsername = PUBLIC_CHANNEL.replace("@", "");
    const caption = 
      `${fileEmoji} ${fileType}\n\n` +
      `📝 TITLE: ${fileName}\n` +
      `👤 Uploaded by: ${username}\n` +
      `📦 Size: ${fileSize}\n` +
      `⏰ Time: ${uploadTime}\n\n` +
      `🤖 Checkout bot: @QuickURL_roBot\n` +
      `📢 Join ${PUBLIC_CHANNEL}`;

    await fetch(`${tgApi}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: PUBLIC_CHANNEL,
        text: caption,
        reply_to_message_id: channelMsgId,
        disable_web_page_preview: true
      })
    });

    const publicUrl = `https://t.me/${channelUsername}/${channelMsgId}`;

    // --- Success reply to user ---
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "✅ Uploaded to QuickURL\n\n" +
      `🔗 File Link:\n${publicUrl}\n\n` +
      `📋 Details:\n` +
      `${fileEmoji} Type: ${fileType}\n` +
      `📦 Size: ${fileSize}\n` +
      `⏰ Uploaded: ${uploadTime}\n\n` +
      `📮 Join @quickURL_files`
    );

    return new Response("Done");
  }
};

async function sendMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
