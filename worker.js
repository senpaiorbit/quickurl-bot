export default {
  async fetch(request) {
    const BOT_TOKEN = "8214031086:AAEDlY1VVTTv-FklSHl0sgFmi_k-T1IQbbs";
    const PUBLIC_CHANNEL = "@quickURL_files";
    const VERCEL_API_URL = "https://quickurl-bot.vercel.app/api/mirror";
    const DB_URL = "postgresql://postgres.hvopahixclbellzicipi:KbVwuzULdLAnAsNh@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

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
        "🔗 I'll generate a public Telegram link instantly\n" +
        "🪞 Plus mirror on multiple servers\n\n" +
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
    let fileId = "";

    if (message.document) {
      fileInfo = message.document;
      fileType = "Document";
      fileEmoji = "📄";
      fileId = message.document.file_id;
    } else if (message.video) {
      fileInfo = message.video;
      fileType = "Video";
      fileEmoji = "🎥";
      fileId = message.video.file_id;
    } else if (message.audio) {
      fileInfo = message.audio;
      fileType = "Audio";
      fileEmoji = "🎵";
      fileId = message.audio.file_id;
    } else if (message.photo) {
      fileInfo = message.photo[message.photo.length - 1];
      fileType = "Photo";
      fileEmoji = "🖼️";
      fileId = message.photo[message.photo.length - 1].file_id;
    }

    const fileName = fileInfo.file_name || `${fileType}_${Date.now()}`;
    const fileSizeBytes = fileInfo.file_size || 0;
    const fileSize = formatFileSize(fileSizeBytes);
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
    const channelUsername = PUBLIC_CHANNEL.replace("@", "");
    const publicUrl = `https://t.me/${channelUsername}/${channelMsgId}`;

    // --- Get Telegram direct URL ---
    const filePathRes = await fetch(`${tgApi}/getFile?file_id=${fileId}`);
    const filePathData = await filePathRes.json();
    let telegramDirectUrl = "";
    
    if (filePathData.ok) {
      const filePath = filePathData.result.file_path;
      telegramDirectUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    }

    // --- Save metadata to Supabase using pg library emulation ---
    let dbRecordId = 0;
    try {
      const insertQuery = `
        INSERT INTO files (file_id, file_name, file_type, file_size, username, telegram_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `;
      
      // Using fetch to simulate pg query (you'll need a serverless function or use Supabase REST API)
      // For simplicity, using Supabase REST API
      const supabaseRes = await fetch(`https://hvopahixclbellzicipi.supabase.co/rest/v1/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'YOUR_SUPABASE_ANON_KEY', // Replace with your actual key
          'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          file_id: fileId,
          file_name: fileName,
          file_type: fileType,
          file_size: fileSizeBytes,
          username: username,
          telegram_url: telegramDirectUrl
        })
      });
      
      const dbData = await supabaseRes.json();
      if (dbData && dbData.length > 0) {
        dbRecordId = dbData[0].id;
      }
    } catch (error) {
      console.error("Database insert error:", error);
    }

    // --- Send caption to channel ---
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

    // --- Call Vercel API for mirroring ---
    let mirrorUrls = {};
    if (dbRecordId > 0) {
      try {
        const mirrorRes = await fetch(`${VERCEL_API_URL}?id=${dbRecordId}`);
        const mirrorData = await mirrorRes.json();
        
        if (mirrorData.success) {
          mirrorUrls = mirrorData;
        }
      } catch (error) {
        console.error("Vercel mirror error:", error);
      }
    }

    // --- Success reply to user ---
    let successMessage =
      "✅ Uploaded to QuickURL\n\n" +
      `🔗 Telegram Link:\n${publicUrl}\n\n`;

    if (mirrorUrls.server1) {
      successMessage += `🪞 Pixeldrain Mirror:\n${mirrorUrls.server1}\n\n`;
    }

    if (mirrorUrls.server2) {
      successMessage += `🪞 DevUploads Mirror:\n${mirrorUrls.server2}\n\n`;
    }

    successMessage +=
      `📋 Details:\n` +
      `${fileEmoji} Type: ${fileType}\n` +
      `📦 Size: ${fileSize}\n` +
      `⏰ Uploaded: ${uploadTime}\n\n` +
      `📮 Join @quickURL_files`;

    await sendMessage(BOT_TOKEN, chatId, successMessage);

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
