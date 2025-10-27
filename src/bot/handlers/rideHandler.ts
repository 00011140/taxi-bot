import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { driverSessions } from "../sessions";
import { showMainMenu } from "./menuHandler";

export function setupRideHandlers(bot: TelegramBot, backendUrl: string) {
    bot.on("callback_query", async (query) => {
        const chatId = query.message?.chat.id!;
        const action = query.data!;
        const token = driverSessions[chatId]?.token;
        if (!token) return;

        const session = driverSessions[chatId];

        if (action.startsWith("accept_")) {
            const rideId = action.split("_")[1];
            await axios.post(`${backendUrl}/driver/accept`, { rideId }, { headers: { Authorization: `Bearer ${token}` } });
            session.currentRideId = rideId;
            bot.sendMessage(chatId, "✅ Ride accepted!", {
                reply_markup: { inline_keyboard: [[{ text: "🚗 Arrived", callback_data: "arrived" }]] },
            });
        } else if (action === "arrived") {
            const rideId = session.currentRideId;
            if (!rideId) return;
            await axios.post(`${backendUrl}/ride/arrived`, { rideId }, { headers: { Authorization: `Bearer ${token}` } });
            bot.sendMessage(chatId, "📍 Arrival confirmed. Waiting for passenger...", {
                reply_markup: { inline_keyboard: [[{ text: "▶️ Start Trip", callback_data: "start_trip" }]] },
            });
        } else if (action === "start_trip") {
            const rideId = session.currentRideId;
            if (!rideId) return;
            await axios.post(`${backendUrl}/ride/start`, { rideId }, { headers: { Authorization: `Bearer ${token}` } });
            bot.sendMessage(chatId, "🛣 Trip started!", {
                reply_markup: { inline_keyboard: [[{ text: "⏹ End Trip", callback_data: "end_trip" }]] },
            });
        } else if (action === "end_trip") {
            const rideId = session.currentRideId;
            if (!rideId) return;
            const res = await axios.post<{ fare: number }>(`${backendUrl}/ride/end`, { rideId }, { headers: { Authorization: `Bearer ${token}` } });
            bot.sendMessage(chatId, `💰 Trip completed! Fare: $${res.data.fare}`);
            session.currentRideId = undefined;
            await showMainMenu(bot, chatId);
        }
    });
}
