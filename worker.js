export default {
  async fetch(request) {
    const BOT_TOKEN = "8214031086:AAEDlY1VVTTv-FklSHl0sgFmi_k-T1IQbbs";
    const PUBLIC_CHANNEL = "@quickURL_files";
    const PIXELDRAIN_KEY = "cc3b6605-22c9-4ee6-a826-54bc62621d81";

    if (request.method !== "POST") {
      return new Response("OK");
    }

    const update = await request.json();
    if (!update.message) return new Response("No message");

    const message = update.message;
    const chatId = message.chat.id;
    const msgId = message.message_id;
    const text = message.text || "";

    // /start
    if (text.startsWith("/start")) {
      await sendMessage(
        BOT_TOKEN,
        chatId,
        "👋 Welcome to QuickURL Bot\n\n" +
        "📤 Send or forward any file\n" +
        "🔗 Get Telegram + mirror link\n\n" +
        "⚡ Powered by @quickURL_files"
      );
      return new Response("OK");
    }

    // Detect file
    let fileInfo, fileEmoji, fileType;
    if (message.document) {
      fileInfo = message.document;
      fileEmoji = "📄";
      fileType = "Document";
    } else if (message.video) {
      fileInfo = message.video;
      fileEmoji = "🎥";
      fileType = "Video";
    } else if (message.audio) {
      fileInfo = message.audio;
      fileEmoji = "🎵";
      fileType = "Audio";
    } else if (message.photo) {
      fileInfo = message.photo[message.photo.length - 1];
      fileEmoji = "🖼️";
      fileType = "Photo";
    } else {
      await sendMessage(BOT_TOKEN, chatId, "❗ Please send a file.");
      return new Response("No file");
    }

    const fileName = fileInfo.file_name || "Image";
    const fileSize = formatFileSize(fileInfo.file_size || 0);
    const username = message.from.username
      ? `@${message.from.username}`
      : message.from.first_name || "Anonymous";
    const uploadTime = formatTime(message.date);

    const tgApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    // Clone to public channel
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
      await sendMessage(BOT_TOKEN, chatId, "❌ Upload failed.");
      return new Response("Fail");
    }

    const channelMsgId = copyData.result.message_id;
    const channelUsername = PUBLIC_CHANNEL.replace("@", "");
    const publicUrl = `https://t.me/${channelUsername}/${channelMsgId}`;

    // Caption reply in channel
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
        reply_to_message_id: channelMsgId
      })
    });

    // ---- PIXELDRAIN MIRROR ----
    let mirrorUrl = "❌ Mirror failed";

    try {
      // 1. Get Telegram file path
      const fileRes = await fetch(
        `${tgApi}/getFile?file_id=${fileInfo.file_id}`
      );
      const fileData = await fileRes.json();

      if (fileData.ok) {
        const tgFileUrl =
          `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;

        // 2. Send URL to PixelDrain
        const pdRes = await fetch("https://pixeldrain.dev/api/file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${PIXELDRAIN_KEY}`
          },
          body: JSON.stringify({
            url: tgFileUrl
          })
        });

        const pdData = await pdRes.json();
        if (pdData.id) {
          mirrorUrl = `https://pixeldrain.com/u/${pdData.id}`;
        }
      }
    } catch (e) {
      mirrorUrl = "❌ Mirror error";
    }

    // Reply to user
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "✅ Uploaded to QuickURL\n\n" +
      `🔗 Telegram Link:\n${publicUrl}\n\n` +
      `🪞 Mirror Link:\n${mirrorUrl}\n\n` +
      `${fileEmoji} ${fileType}\n` +
      `📦 Size: ${fileSize}\n` +
      `⏰ Time: ${uploadTime}\n\n` +
      "📮 Join @quickURL_files"
    );

    return new Response("Done");
  }
};

// -------- helpers --------

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

function formatFileSize(bytes) {
  if (!bytes) return "Unknown";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return `${d.getDate().toString().padStart(2, "0")}/` +
         `${(d.getMonth()+1).toString().padStart(2, "0")}/` +
         `${d.getFullYear()} ` +
         `${d.getHours().toString().padStart(2, "0")}:` +
         `${d.getMinutes().toString().padStart(2, "0")}`;
}
