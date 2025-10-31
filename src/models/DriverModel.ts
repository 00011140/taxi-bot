import mongoose, { Schema, Document } from "mongoose";

export interface IDriverDocument extends Document {
    id: string;
    name: string;
    phone: string;
    vehicle: string;
    status: "offline" | "available" | "on_trip";
    location?: { lat: number; lon: number };
    otp?: string;
    otpExpiresAt?: Date;
    chatId?: number;
    currentRideId?: string;
}

const DriverSchema = new Schema<IDriverDocument>(
    {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        phone: { type: String, required: true, unique: true },
        vehicle: { type: String },
        status: { type: String, enum: ["offline", "available", "on_trip"], default: "offline" },
        location: {
            lat: Number,
            lon: Number,
        },
        otp: String,
        otpExpiresAt: Date,
        chatId: Number,
        currentRideId: { type: String },
    },
    { timestamps: true }
);

export const DriverModel = mongoose.model<IDriverDocument>("Driver", DriverSchema);
