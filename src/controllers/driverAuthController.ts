// src/interfaces/http/driverAuthController.ts
import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import { MongoDriverRepo } from "../infra/repos/MongoDriverRepo";

export function makeDriverAuthController(driverRepo: MongoDriverRepo) {
    const router = express.Router();

    // Step 1: request OTP
    router.post("/request-otp", async (req, res) => {
        const { phone, chatId } = req.body;
        console.log(phone)
        console.log(chatId)
        if (!phone || !chatId) return res.status(400).json({ error: "Phone and chatId required" });

        const driver = await driverRepo.findByPhone(phone);
        if (!driver) return res.status(404).json({ error: "Driver not found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await driverRepo.save({ ...driver, otp, otpExpiresAt, chatId });

        // // Send OTP via Telegram
        // await axios.post(`https://api.telegram.org/bot${process.env.DRIVER_BOT_TOKEN}/sendMessage`, {
        //     chat_id: chatId,
        //     text: `🔐 Your login code: *${otp}*`,
        //     parse_mode: "Markdown",
        // });
        await sendOtpViaTelegram(chatId, otp);
        res.json({ message: "OTP sent via Telegram" });
    });

    // Step 2: verify OTP
    router.post("/verify-otp", async (req, res) => {
        const { phone, otp } = req.body;
        if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });

        const driver = await driverRepo.findByPhone(phone);
        if (!driver || driver.otp !== otp || new Date(driver.otpExpiresAt!) < new Date())
            return res.status(401).json({ error: "Invalid or expired OTP" });

        const token = jwt.sign({ id: driver.id, phone: driver.phone }, process.env.JWT_SECRET!, {
            expiresIn: "7d",
        });

        driver.otp = undefined;
        driver.otpExpiresAt = undefined;
        await driverRepo.save(driver);

        res.json({ token, driver });
    });

    return router;
}

async function sendOtpViaTelegram(chatId: number | string, otp: string) {
    const token = process.env.DRIVER_BOT_TOKEN;
    if (!token) {
        console.error("❌ TELEGRAM_TOKEN missing in env");
        throw new Error("Telegram token missing");
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: `🔐 Your login code: *${otp}*`,
        parse_mode: "Markdown",
    };

    try {
        const res = await axios.post(url, payload, { timeout: 10_000 });
        let response = res.data as any;
        if (response.ok !== true) {
            console.warn("⚠️ Telegram sendMessage responded with non-ok:", res.data);
        }
        return res.data;
    } catch (err: unknown) {
        console.error("❌ Failed to send OTP via Telegram:", err);
        throw err; // rethrow unexpected ones
    }
}