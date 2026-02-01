import TelegramBot from "node-telegram-bot-api";

const BOT_TOKEN = "8214031086:AAEDlY1VVTTv-FklSHl0sgFmi_k-T1IQbbs";
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  // Accept document, video, audio, photo
  const file =
    msg.document ||
    msg.video ||
    msg.audio ||
    (msg.photo ? msg.photo[msg.photo.length - 1] : null);

  if (!file) {
    return bot.sendMessage(chatId, "❌ Send a file first");
  }

  try {
    const fileInfo = await bot.getFile(file.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;

    await bot.sendMessage(chatId, `✅ File URL:\n${fileUrl}`);
  } catch (err) {
    await bot.sendMessage(chatId, "⚠️ Failed to generate URL");
  }
});
