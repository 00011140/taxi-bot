import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { driverSessions } from "../sessions";
import { showMainMenu } from "./menuHandler";

export function setupLocationHandler(bot: TelegramBot, backendUrl: string) {
    bot.on("location", async (msg) => {
        const chatId = msg.chat.id;
        const token = driverSessions[chatId]?.token;
        if (!token) return bot.sendMessage(chatId, "⚠️ Please log in first.");

        const { latitude, longitude } = msg.location!;
        try {
            await axios.post(`${backendUrl}/driver/update-location`, { lat: latitude, lon: longitude }, { headers: { Authorization: `Bearer ${token}` } });
            await axios.post(`${backendUrl}/driver/status`, { status: "online" }, { headers: { Authorization: `Bearer ${token}` } });
            driverSessions[chatId].status = "online";
            bot.sendMessage(chatId, "🟢 You are now online and visible to riders.");
            await showMainMenu(bot, chatId);
        } catch (err: any) {
            bot.sendMessage(chatId, `❌ Location update failed: ${err.response?.data?.error || err.message}`);
        }
    });
}
