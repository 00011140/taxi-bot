// src/gateway/socket.ts
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import http from "http";
import { RideModel } from "../models/Ride";
import { DriverModel } from "../models/DriverModel";

interface SocketAuthPayload {
    id: string;
    phone?: string;
}

let io: Server;
const driverSockets = new Map<string, string>(); // driverId -> socketId
const userSockets = new Map<number, string>(); // userChatId -> socketId

export const initSocketServer = (server: http.Server) => {
    io = new Server(server, {
        cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
        // Two modes of auth:
        //  - driver: send auth { token: <JWT> } in handshake
        //  - user: send auth { userChatId: <number> } in handshake (no JWT), OR include both if desired
        const { token, userChatId } = socket.handshake.auth as any || {};

        // If driver connects with token -> validate and register
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as SocketAuthPayload;
                const driverId = decoded.id;
                driverSockets.set(driverId, socket.id);
                console.log(`🚗 Driver connected: ${driverId} (socket ${socket.id})`);

                // handle driver accept via socket (real-time acceptance)
                socket.on("accept_ride", async (payload: { rideId: string }) => {
                    const { rideId } = payload;
                    console.log(`📩 Driver ${driverId} accepting ride ${rideId}`);

                    const ride = await RideModel.findOne({ id: rideId });
                    if (!ride) {
                        socket.emit("error", { message: "Ride not found" });
                        return;
                    }

                    // check if ride still pending/offered
                    if (ride.status !== "pending" && ride.status !== "offered") {
                        socket.emit("error", { message: "Ride not available" });
                        return;
                    }

                    // assign
                    ride.driverId = driverId;
                    ride.status = "accepted";
                    await ride.save();

                    // mark driver currentRideId in DB
                    await DriverModel.findOneAndUpdate({ id: driverId }, { currentRideId: rideId });

                    // send confirmation to driver
                    socket.emit("ride_status", { status: "accepted", rideId });

                    // notify user (if connected)
                    if (ride.userChatId) {
                        const userSocketId = userSockets.get(ride.userChatId);
                        if (userSocketId) {
                            io.to(userSocketId).emit("ride_assigned", {
                                rideId: ride.id,
                                driver: {
                                    id: driverId,
                                    // you may fetch more driver details as needed
                                },
                            });
                        }
                    }

                    console.log(`✅ Ride ${rideId} assigned to driver ${driverId}`);
                });

                socket.on("disconnect", () => {
                    driverSockets.delete(driverId);
                    console.log(`❌ Driver disconnected: ${driverId}`);
                });

                return; // done driver setup
            } catch (err) {
                console.warn("Invalid JWT on socket connection -> disconnecting");
                socket.disconnect(true);
                return;
            }
        }

        // If user connects with userChatId (so we can notify them)
        if (userChatId) {
            userSockets.set(Number(userChatId), socket.id);
            console.log(`👤 User connected: chatId=${userChatId} (socket ${socket.id})`);

            socket.on("disconnect", () => {
                userSockets.delete(Number(userChatId));
                console.log(`❌ User disconnected: chatId=${userChatId}`);
            });
            return;
        }

        // No auth => disconnect
        socket.disconnect(true);
    });

    console.log("✅ WebSocket gateway initialized");
    return io;
};

// send a ride offer to a driver
export const sendRideOffer = (driverId: string, ride: any) => {
    const socketId = driverSockets.get(driverId);
    if (!socketId) {
        console.log(`⚠️ Driver ${driverId} not connected — cannot send ride_offer`);
        return false;
    }
    io.to(socketId).emit("ride_offer", ride);
    console.log(`📤 Ride offer sent to driver ${driverId}`);
    return true;
};

// notify a user (by Telegram chat id)
export const notifyUser = (userChatId: number, event: string, payload: any) => {
    const socketId = userSockets.get(userChatId);
    if (!socketId) {
        console.log(`⚠️ User chat ${userChatId} not connected — can't send ${event}`);
        return false;
    }
    io.to(socketId).emit(event, payload);
    return true;
};
