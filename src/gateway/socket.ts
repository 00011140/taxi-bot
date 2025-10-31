// src/gateway/socket.ts
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import http from "http";
import { IRide, RideModel } from "../models/Ride";
import { DriverModel } from "../models/DriverModel";
import { Socket } from "socket.io-client";

export interface SocketAuthPayload {
    id: string;
    phone?: string;
}

export let socketIo: Server;
export const driverSockets = new Map<string, string>(); // driverId -> socketId
export const userSockets = new Map<number, string>(); // userChatId -> socketId

export const initSocketServer = (server: http.Server) => {
    socketIo = new Server(server, {
        cors: { origin: "*" },
    });

    socketIo.on("connection", (socket) => {
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
                    console.log("RIDE_ACCEPTED SOCKET");

                    const { rideId } = payload;
                    console.log(`📩 Driver ${driverId} accepting ride ${rideId}`);

                    const ride = await RideModel.findOne({ _id: rideId });
                    if (!ride) {
                        socket.emit("error", { message: "Ride not found" });
                        return;
                    }

                    // check if ride still pending/offered
                    if (ride.status !== "pending" && ride.status !== "offered") {
                        socket.emit("error", { message: "Ride not available" });
                        return;
                    }

                    // assign ride to driver
                    ride.driverId = driverId;
                    ride.status = "accepted";
                    await ride.save();

                    // mark driver currentRideId in DB
                    const driver = await DriverModel.findOneAndUpdate(
                        { id: driverId },
                        { currentRideId: rideId },
                        { new: true }
                    );

                    // send confirmation to driver
                    socket.emit("ride_status", { status: "accepted", rideId });

                    // ✅ notify user (if connected)
                    if (ride.userChatId) {
                        console.log(`ride.userChatId: ${ride.userChatId}`)
                        const userSocketId = userSockets.get(ride.userChatId);
                        console.log(`userSocketId: ${userSocketId} Driver: ${driver}`)
                        if (userSocketId && driver) {
                            socketIo.to(userSocketId).emit("ride_assigned", {
                                rideId: ride.id,
                                chatId: ride.userChatId,
                                driver: {
                                    id: driver.id,
                                    name: driver.name,
                                    vehicle: driver.vehicle,
                                    phone: driver.phone,
                                    location: driver.location, // send driver's current coords
                                },
                                message: "🚗 Your driver is on the way!",
                            });
                        }
                    }

                    // 🗺️ Send user pickup location to driver
                    const driverSocketId = driverSockets.get(driverId);
                    console.log(`driverSocketId: ${driverSocketId}`);
                    console.log(`ride.pickup: ${ride.pickup}`);

                    if (driverSocketId && ride.pickup) {
                        socketIo.to(driverSocketId).emit("user_location", {
                            lat: ride.pickup.lat,
                            lon: ride.pickup.lon,
                            address: ride.pickup.address || "Pickup point",
                        });
                        console.log(`📍 Sent user location to driver ${driverId}`);
                    }


                    console.log(`✅ Ride ${rideId} assigned to driver ${driverId}`);
                });

                socket.on("driver_arrived", async (payload: { rideId: string }) => {
                    const { rideId } = payload;
                    let ride = await checkRide({ rideId, status: "arrived" });
                    if (!ride) return socket.emit("error", "Ride not found");

                    // notify user
                    const userSocketId = userSockets.get(Number(ride.userChatId));
                    if (userSocketId) {
                        socketIo.to(userSocketId).emit("ride_status_update", {
                            status: "arrived",
                            message: "🚗 Haydovchi yetib keldi!",
                        });
                    }

                    console.log(`✅ Driver arrived for ride ${rideId}`);
                });

                socket.on("ride_started", async (rideId: string) => {
                    let ride = await checkRide({ rideId, status: "started" });
                    if (!ride) return socket.emit("error", "Ride not found");
                    const userSocketId = userSockets.get(Number(ride.userChatId));

                    if (userSocketId) {
                        socketIo.to(userSocketId).emit("ride_started",);
                    }
                });

                socket.on("ride_completed", async (rideId: string) => {
                    let ride = await checkRide({ rideId, status: "completed" });
                    if (!ride) return socket.emit("error", "Ride not found");
                    const userSocketId = userSockets.get(Number(ride.userChatId));

                    if (userSocketId) {
                        socketIo.to(userSocketId).emit("ride_completed",);
                    }
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
    return socketIo;
};

const checkRide = async (paylod: { rideId: string, status: string }): Promise<IRide | null> => {
    let { rideId, status } = paylod;
    const ride = await RideModel.findOne({ _id: rideId });

    if (ride) {
        ride.status = status;
        if (status == "started") {
            ride.lastLocation = { lat: ride!.pickup.lat, lon: ride!.pickup.lon };
        }
        await ride.save();
    }

    return ride;
}

// send a ride offer to a driver
export const sendRideOffer = (driverId: string, ride: any) => {
    const socketId = driverSockets.get(driverId);
    console.log(driverId);
    if (!socketId) {
        console.log(`⚠️ Driver ${driverId} not connected — cannot send ride_offer`);
        return false;
    }
    socketIo.to(socketId).emit("ride_offer", ride);
    console.log(`📤 Ride offer sent to driver ${driverId}`);
    return true;
};

// notify a user (by Telegram chat id)
export const notifyUser = (userChatId: number, event: string, payload: any) => {
    console.log();
    userSockets.forEach((val, key) => {
        console.log(val, key);
    })
    const socketId = userSockets.get(Number(userChatId));
    if (!socketId) {
        console.log(`⚠️ User chat ${userChatId} not connected — can't send ${event}`);
        return false;
    }
    socketIo.to(socketId).emit(event, payload);
    return true;
};
