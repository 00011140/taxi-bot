import { io, Socket } from "socket.io-client";
import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api";

export function initDriverSocket(bot: TelegramBot, chatId: number, backendUrl: string, token: string): Socket {
    const socket = io(backendUrl, { auth: { token } });

    socket.on("connect", () => {
        console.log(`✅ Driver ${chatId} connected via WebSocket`);
        bot.sendMessage(chatId, "🟢 Connected to dispatch server. Ready for rides!");
    });

    socket.on("disconnect", () => {
        bot.sendMessage(chatId, "🔴 Lost connection. Please go online again.");
    });

    socket.on("ride_offer", async (ride: any) => {
        const msg = `🚘 *New Ride Offer*\nPickup: ${ride.pickup.address}\nDropoff: ${ride.dropoff.address}\nFare: $${ride.fareEstimate}`;
        const opts: SendMessageOptions = {
            parse_mode: "Markdown" as const, // ✅ make it a valid ParseMode literal
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Accept", callback_data: `accept_${ride.id}` }],
                    [{ text: "❌ Decline", callback_data: `decline_${ride.id}` }],
                ],
            },
        };
        await bot.sendMessage(chatId, msg, opts);
    });

    socket.on("ride_status", (status: any) => {
        bot.sendMessage(chatId, `ℹ️ Ride status: ${status.status}`);
    });

    socket.on("error", (err: any) => {
        console.error("❌ Socket error:", err);
        bot.sendMessage(chatId, `❌ Socket error: ${err.message || err}`);
    });

    return socket;
}
