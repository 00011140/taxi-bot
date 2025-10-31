// userSocket.ts
import { io, Socket } from "socket.io-client";
import TelegramBot from "node-telegram-bot-api";

export let userSocket: Socket;

export function initUserSocket(bot: TelegramBot, sessions: Record<number, any>, chatId: number) {
    // 👇 For demo simplicity, just pick one socket per bot process.
    // Each user gets a chatId when they send /start or location.
    userSocket = io(process.env.BACKEND_URL!, {
        transports: ["websocket"],
        auth: {
            userChatId: chatId || "unknown", // 👈 first known chatId
        },
    });

    userSocket.on("connect", () => {
        console.log("✅ User socket connected");
    });

    userSocket.on("connect_error", (err) => {
        console.error("🚨 User socket connection error:", err.message);
    });

    userSocket.on("ride_assigned", async (data: any) => {
        const { chatId, driver } = data;
        await bot.sendMessage(
            chatId,
            `🚖 Haydovchi yo'lga chiqdi! \n\n👨‍✈️ ${driver.name}\n🚗 ${driver.vehicle}\n📞 ${driver.phone} \n\n Haydovchini pasdagi lokatsiyada kuzatib boring👇`
        );

        // ✅ Send driver's location on map
        if (driver.location) {
            await bot.sendLocation(chatId, driver.location.lat, driver.location.lon, {
                live_period: 3600, // optional: show live map for 1 hour
            });
        }
    });

    userSocket.on("driver_location_update", async (data: any) => {
        const { chatId, location } = data;
        const session = sessions[chatId];

        // If first time, send a new live location
        if (!session?.messageId) {
            const sent = await bot.sendLocation(chatId, location.lat, location.lon, {
                live_period: 3600, // 1 hour
            });
            sessions[chatId] = { ...session, messageId: sent.message_id, lastLocation: location };
            return;
        }

        // Skip if the change is too small (avoid spam)
        const last = session.lastLocation;
        const distanceMoved =
            Math.hypot(location.lat - last.lat, location.lon - last.lon) * 111_000; // meters roughly

        if (distanceMoved < 5) return; // Skip updates under 5m

        try {
            await bot.editMessageLiveLocation(location.lat, location.lon, {
                chat_id: chatId,
                message_id: session.messageId,
            });

            // Save last location
            sessions[chatId].lastLocation = location;
        } catch (err: any) {
            if (err.response?.body?.description?.includes("message is not modified")) {
                console.log("⏩ Skipped identical location update");
            } else {
                console.error("❌ Live location edit failed:", err);
            }
        }
    });

    userSocket.on("ride_status_update", async (payload: { status: string, message: string }) => {
        let { status, message } = payload;
        await bot.sendMessage(chatId, message);
    });

    userSocket.on("ride_started", async (data: any) => {
        const message = await bot.sendMessage(
            chatId,
            "🏁 Safaringiz boshlandi, Oq yo'l!\n📍 Masofa: 0.00 km\n💰 Yo'l haqqi: 0 UZS"
        );

        // Store the message ID so we can edit it later
        sessions[chatId].fareMessageId = message.message_id;
    });

    userSocket.on("ride_progress", async (data: any) => {
        const { distance, fare } = data;
        const session = sessions[chatId];

        if (!session || !session.fareMessageId) return;

        try {
            await bot.editMessageText(
                `🚗 Trip in progress\n📍 Distance: ${distance} km\n💰 Fare: ${fare} UZS`,
                {
                    chat_id: chatId,
                    message_id: session.fareMessageId,
                }
            );
        } catch (err) {
            console.error("❌ Failed to edit fare message:", err);
        }
    });

    userSocket.on("ride_completed", async (data: any) => {
        const session = sessions[chatId];
        if (!session?.fareMessageId) return;

        await bot.sendMessage(chatId,
            `✅ Safar yakunladndi!`
        );
    });

    userSocket.on("disconnect", () => {
        console.log("❌ User socket disconnected");
    });
}
