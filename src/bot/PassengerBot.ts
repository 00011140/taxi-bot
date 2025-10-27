import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { initUserSocket } from "./socket/userSocket";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.USER_BOT_TOKEN!;
const backendUrl = process.env.BACKEND_URL!;
export const userBot = new TelegramBot(token, { polling: true });

const userSessions: Record<number, { location?: { lat: number; lon: number }; rideId?: string }> = {};
interface RequestRideResponse {
    rideId: string;
    message?: string;
}

// /start command
userBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userBot.sendMessage(
        chatId,
        "👋 Welcome to PayTube Taxi! Please share your location to request a ride.",
        {
            reply_markup: {
                keyboard: [[{ text: "📍 Share Location", request_location: true }]],
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        }
    );
});

// Handle location sharing
userBot.on("location", async (msg) => {
    const chatId = msg.chat.id;
    const { latitude, longitude } = msg.location!;
    userSessions[chatId] = { location: { lat: latitude, lon: longitude } };

    userBot.sendMessage(chatId, "🚕 Searching for nearby drivers...");

    try {
        const res = await axios.post<RequestRideResponse>(`${backendUrl}/user/request-ride`, {
            chatId,
            location: { lat: latitude, lon: longitude },
        });
        userSessions[chatId].rideId = res.data.rideId;
        userBot.sendMessage(chatId, "✅ Ride request sent! Waiting for a driver...");
    } catch (e: any) {
        userBot.sendMessage(chatId, `❌ Failed to request ride: ${e.response?.data?.error || e.message}`);
    }
});

// Initialize user WebSocket connection
initUserSocket(userBot, userSessions);
