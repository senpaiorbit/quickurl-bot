export default {
  async fetch(request, env, ctx) {
    try {
      // Telegram sometimes sends GET for webhook check
      if (request.method !== "POST") {
        return new Response("OK", { status: 200 });
      }

      const update = await request.json();

      // SAFETY: always respond fast
      ctx.waitUntil(handleUpdate(update, env));

      return new Response("OK", { status: 200 });

    } catch (err) {
      return new Response("ERROR", { status: 200 });
    }
  }
};

async function handleUpdate(update, env) {
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const text = msg.text || "";

  // /start handler
  if (text.startsWith("/start")) {
    await sendMessage(
      env,
      chatId,
      "👋 Welcome to QuickURL Bot\n\n" +
      "📤 Send or forward any file\n" +
      "🔗 I will generate a public Telegram link\n\n" +
      "📮 Channel: @quickURL_files"
    );
    return;
  }

  const hasFile =
    msg.document ||
    msg.video ||
    msg.audio ||
    msg.photo;

  if (!hasFile) {
    await sendMessage(
      env,
      chatId,
      "❗ Please send or forward a file."
    );
    return;
  }

  const tgApi = `https://api.telegram.org/bot${env.BOT_TOKEN}`;

  const copy = await fetch(`${tgApi}/copyMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.PUBLIC_CHANNEL,
      from_chat_id: chatId,
      message_id: msg.message_id
    })
  });

  const data = await copy.json();
  if (!data.ok) {
    await sendMessage(env, chatId, "❌ Failed to upload");
    return;
  }

  const channelMsgId = data.result.message_id;
  const channel = env.PUBLIC_CHANNEL.replace("@", "");
  const url = `https://t.me/${channel}/${channelMsgId}`;

  await sendMessage(
    env,
    chatId,
    `✅ Uploaded\n\n🔗 File Link:\n${url}\n\n🔗 Easy Copy:\n${url}`
  );
}

async function sendMessage(env, chatId, text) {
  await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    }
  );
}
