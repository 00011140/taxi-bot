import { io } from "socket.io-client";
import TelegramBot from "node-telegram-bot-api";

export function initUserSocket(bot: TelegramBot, sessions: any) {
    const socket = io(process.env.BACKEND_URL!, {
        transports: ["websocket"],
    });

    socket.on("connect", () => {
        console.log("✅ User socket connected");
    });

    socket.on("ride_assigned", async (data: any) => {
        const { chatId, driver } = data;
        await bot.sendMessage(
            chatId,
            `🚖 Driver found!\n\n👨‍✈️ ${driver.name}\n🚗 ${driver.vehicle}\n📞 ${driver.phone}`
        );
    });

    socket.on("driver_arrived", async (data: any) => {
        const { chatId } = data;
        await bot.sendMessage(chatId, "📍 Your driver has arrived!");
    });

    socket.on("ride_started", async (data: any) => {
        const { chatId } = data;
        await bot.sendMessage(chatId, "🏁 Your trip has started. Enjoy your ride!");
    });

    socket.on("ride_update", async (data: any) => {
        const { chatId, fare, km } = data;
        await bot.sendMessage(chatId, `📊 Distance: ${km.toFixed(2)} km\n💵 Fare: $${fare.toFixed(2)}`);
    });

    socket.on("ride_completed", async (data: any) => {
        const { chatId, fare } = data;
        await bot.sendMessage(chatId, `✅ Trip completed!\nFinal Fare: $${fare.toFixed(2)}\n⭐ Please rate your ride!`);
    });

    socket.on("disconnect", () => {
        console.log("❌ User socket disconnected");
    });
}
