// src/models/Ride.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IRide extends Document {
    userId?: string;
    userChatId?: number;                // Telegram chat id for the user
    driverId?: string | null;
    pickup: { lat: number; lon: number; address?: string };
    dropoff?: { lat: number; lon: number; address?: string };
    status: string | "pending" | "offered" | "accepted" | "arrived" | "waiting_for_user" | "started" | "completed" | "cancelled";
    fare?: number;
    fareEstimate?: number;
    distanceKm?: number;
    createdAt?: Date;
    startedAt?: Date;
    endedAt?: Date;
    distanceTraveled: number,
    lastLocation: {
        lat: Number,
        lon: Number,
    },
}

const rideSchema = new Schema<IRide>({
    userId: String,
    userChatId: Number,
    driverId: String,
    pickup: {
        lat: Number,
        lon: Number,
        address: String,
    },
    dropoff: {
        lat: Number,
        lon: Number,
        address: String,
    },
    status: {
        type: String,
        enum: ["pending", "offered", "accepted", "arrived", "started", "completed", "cancelled"],
        default: "pending",
    },
    fare: Number,
    fareEstimate: Number,
    distanceKm: Number,
    createdAt: { type: Date, default: Date.now },
    startedAt: Date,
    endedAt: Date,
    distanceTraveled: { type: Number, default: 0 },
    lastLocation: {
        lat: Number,
        lon: Number,
    },
});

export const RideModel = mongoose.model<IRide>("Ride", rideSchema);
