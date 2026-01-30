export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("OK");
    }

    const update = await request.json();
    const message = update.message;

    if (!message) {
      return new Response("No message");
    }

    const chatId = message.chat.id;
    const msgId = message.message_id;

    // Only process messages with files
    const hasFile =
      message.document ||
      message.video ||
      message.audio ||
      message.photo;

    if (!hasFile) {
      return new Response("No file");
    }

    const tgApi = `https://api.telegram.org/bot${env.BOT_TOKEN}`;

    // Clone message to public channel
    const copyRes = await fetch(`${tgApi}/copyMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.PUBLIC_CHANNEL,
        from_chat_id: chatId,
        message_id: msgId
      })
    });

    const copyData = await copyRes.json();

    if (!copyData.ok) {
      await sendMessage(env, chatId, "❌ Upload failed");
      return new Response("Copy failed");
    }

    const channelMsgId = copyData.result.message_id;
    const channelId = env.PUBLIC_CHANNEL.replace("@", "");

    const publicUrl = `https://t.me/${channelId}/${channelMsgId}`;

    await sendMessage(
      env,
      chatId,
      `✅ Uploaded to QuickURL\n\n🔗 File Link:\n${publicUrl}\n\n🔗 Easy Copy:\n${publicUrl}`
    );

    return new Response("Done");
  }
};

async function sendMessage(env, chatId, text) {
  const tgApi = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  await fetch(tgApi, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });
}
