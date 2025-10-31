import { io, Socket } from "socket.io-client";
import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api";

export let driverSocket: Socket;

export function initDriverSocket(bot: TelegramBot, chatId: number, backendUrl: string, token: string): Socket {
    driverSocket = io(backendUrl, { auth: { token } });

    driverSocket.on("connect", () => {
        console.log(`✅ Driver ${chatId} connected via WebSocket`);
        bot.sendMessage(chatId, "🟢 Connected to dispatch server. Ready for rides!");
    });

    driverSocket.on("disconnect", () => {
        bot.sendMessage(chatId, "🔴 Lost connection. Please go online again.");
    });

    driverSocket.on("ride_offer", async (ride: any) => {
        const msg = `🚘 *New Ride Offer*\nPickup: ${ride.pickup.address}\nDropoff: ${ride.dropoff.address}\nFare: $${ride.fareEstimate}`;
        const opts: SendMessageOptions = {
            parse_mode: "Markdown" as const, // ✅ make it a valid ParseMode literal
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Accept", callback_data: `accept_${ride.id}_${ride.userChatId}` }],
                    [{ text: "❌ Decline", callback_data: `decline_${ride.id}` }],
                ],
            },
        };
        await bot.sendMessage(chatId, msg, opts);
    });


    driverSocket.on("user_location", async (data: any) => {
        const { lat, lon, address } = data;

        // Send Telegram map location to driver
        await bot.sendLocation(chatId, lat, lon);
        await bot.sendMessage(chatId, `📍 Navigate to pickup: ${address}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚗 Arrived at pickup", callback_data: "arrived" }],
                    [{ text: "❌ Cancel ride", callback_data: "cancel_ride" }],
                ],
            },
        });
    });

    driverSocket.on("ride_status", (status: any) => {
        bot.sendMessage(chatId, `ℹ️ Ride status: ${status.status}`);
    });

    driverSocket.on("error", (err: any) => {
        console.error("❌ Socket error:", err);
        bot.sendMessage(chatId, `❌ Socket error: ${err.message || err}`);
    });

    return driverSocket;
}
