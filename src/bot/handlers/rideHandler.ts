import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { driverSessions } from "../sessions";
import { showMainMenu } from "./menuHandler";
import { DriverModel } from "../../models/DriverModel";
import { driverSocket } from "../socket/driverSocket";
import { userSocket } from "../socket/userSocket";

export function setupRideHandlers(bot: TelegramBot, backendUrl: string) {
    bot.on("callback_query", async (query) => {
        const chatId = query.message?.chat.id!;
        const action = query.data!;
        const token = driverSessions[chatId]?.token;
        console.log(`token: ${token}`);
        if (!token) return;

        const session = driverSessions[chatId];
        const rideId = session.currentRideId;
        console.log(`ACTION: ${action}`);


        if (action.startsWith("accept_")) {
            const rideId = action.split("_")[1];
            driverSocket.emit("accept_ride", { rideId });
            session.currentRideId = rideId;

        } else if (action === "arrived") {
            if (!rideId) return;
            driverSocket.emit("driver_arrived", { rideId });
            bot.sendMessage(chatId, "📍 Arrival confirmed. Waiting for passenger...", {
                reply_markup: { inline_keyboard: [[{ text: "▶️ Start Trip", callback_data: "start_trip" }]] },
            });

        } else if (action === "start_trip") {
            driverSocket.emit("ride_started", rideId);

            await bot.sendMessage(chatId, "Trip in progress...", {
                reply_markup: {
                    inline_keyboard: [[{ text: "🛑 End Ride", callback_data: "end_trip" }]],
                },
            });
        } else if (action === "end_trip") {
            driverSocket.emit("ride_completed", rideId);

            await bot.sendMessage(chatId, "✅ Ride ended. Fare calculated.");
        }
    });
}
