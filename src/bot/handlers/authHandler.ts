import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { driverSessions } from "../sessions";
import { initDriverSocket } from "../socket/driverSocket";
import { showMainMenu } from "./menuHandler";

interface VerifyOtpResponse {
    token: string;
}

export function setupAuthHandlers(bot: TelegramBot, backendUrl: string) {
    // /start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const session = driverSessions[chatId];

        if (session?.token) return showMainMenu(bot, chatId);

        bot.sendMessage(chatId, "👋 Welcome to PayTube Driver Bot!\nPlease share your phone number to log in.", {
            reply_markup: {
                keyboard: [[{ text: "📱 Share Contact", request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        });
    });

    // handle contact
    bot.on("contact", async (msg) => {
        const chatId = msg.chat.id;
        const phone = msg.contact?.phone_number;
        if (!phone) return;

        try {
            await axios.post(`${backendUrl}/driver/request-otp`, { phone, chatId });
            driverSessions[chatId] = { phone };
            bot.sendMessage(chatId, "✅ OTP sent to your Telegram! Enter the 6-digit code.");
        } catch (err: any) {
            bot.sendMessage(chatId, `❌ Login failed: ${err.response?.data?.error || err.message}`);
        }
    });

    // handle OTP
    bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text?.trim();
        if (!/^\d{6}$/.test(text || "")) return;

        const session = driverSessions[chatId];
        if (!session?.phone) return bot.sendMessage(chatId, "⚠️ Please start again with /start.");

        try {
            const res = await axios.post<VerifyOtpResponse>(`${backendUrl}/driver/verify-otp`, {
                phone: session.phone,
                otp: text,
            });
            const token = res.data.token;
            driverSessions[chatId].token = token;
            driverSessions[chatId].status = "offline";

            initDriverSocket(bot, chatId, backendUrl, token);
            await showMainMenu(bot, chatId);
        } catch (e: any) {
            bot.sendMessage(chatId, `❌ OTP invalid: ${e.response?.data?.error || e.message}`);
        }
    });
}
