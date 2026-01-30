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
        "Supported: documents, videos, audio, photos."
      );
      return new Response("No file");
    }

    const tgApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

    // --- Clone message to public channel ---
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

    // --- Success reply ---
    await sendMessage(
      BOT_TOKEN,
      chatId,
      "✅ Uploaded to QuickURL\n\n" +
      `🔗 File Link:\n${publicUrl}\n\n` +
      `🔗 Easy Copy:\n${publicUrl}\n\n` +
      "📮 Join @quickURL_files"
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
