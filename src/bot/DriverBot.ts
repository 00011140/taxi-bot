import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { setupAuthHandlers } from "./handlers/authHandler";
import { setupMenuHandlers } from "./handlers/menuHandler";
import { setupRideHandlers } from "./handlers/rideHandler";
import { setupLocationHandler } from "./handlers/locationHandler";

dotenv.config();

const bot = new TelegramBot(process.env.DRIVER_BOT_TOKEN!, { polling: true });
const BACKEND_URL = process.env.BACKEND_URL!;

// register handlers
setupAuthHandlers(bot, BACKEND_URL);
setupMenuHandlers(bot, BACKEND_URL);
setupRideHandlers(bot, BACKEND_URL);
setupLocationHandler(bot, BACKEND_URL);

console.log("🚖 PayTube Driver Bot is running...");
