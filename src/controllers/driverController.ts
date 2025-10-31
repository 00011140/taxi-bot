import { Request, Response } from "express";
import { DriverModel } from "../models/DriverModel";
import { RideModel } from "../models/Ride";
import { AuthRequest } from "../middlewares/auth";
import { driverSockets, socketIo, notifyUser, userSockets } from "../gateway/socket";
import haversine from "haversine-distance";

export const updateLocation = async (req: AuthRequest, res: Response) => {
    const { lat, lon } = req.body;
    if (!lat || !lon) return res.status(400).json({ error: "lat/lon required" });
    console.log(req.driverId);
    const driver = await DriverModel.findOneAndUpdate(
        { id: req.driverId },
        { location: { lat, lon } },
        { new: true }
    );
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    // ✅ Broadcast driver movement if on an active ride
    if (driver.currentRideId) {
        const ride = await RideModel.findOne({ _id: driver.currentRideId });

        if (ride?.userChatId) {
            const userSocketId = userSockets.get(ride.userChatId);
            if (userSocketId) {
                socketIo.to(userSocketId).emit("driver_location_update", {
                    chatId: ride.userChatId,
                    location: { lat, lon },
                });
            }
        }

        if (ride && ride.status === "started") {

            if (ride.lastLocation) {
                console.log(`ride.lastLocation.lat: ${ride.lastLocation.lat}`);
                console.log(`lat: ${lat}`);
                const distanceMeters = haversine(
                    { lat: Number(ride.lastLocation.lat), lon: Number(ride.lastLocation.lon) },
                    { lat: Number(lat), lon: Number(lon) }
                );
                console.log(`distanceMeters: ${distanceMeters}`);
                const distanceKm = distanceMeters / 1000;
                console.log(`ride.distanceTraveled: ${ride.distanceTraveled}`);
                ride.distanceTraveled += distanceKm;

                const ratePerKm = 2000; // UZS/km
                ride.fare = Math.round(ride.distanceTraveled * ratePerKm);
            }

            ride.lastLocation = { lat, lon };
            await ride.save();

            // Optionally notify the user in real time
            const userSocketId = userSockets.get(Number(ride.userChatId));
            if (userSocketId) {
                socketIo.to(userSocketId).emit("ride_progress", {
                    distance: ride.distanceTraveled.toFixed(2),
                    fare: ride.fare,
                });
            }
        }
    }

    return res.json({ success: true, location: driver.location });
};

export const updateStatus = async (req: AuthRequest, res: Response) => {
    const { status } = req.body;
    if (!["online", "offline"].includes(status))
        return res.status(400).json({ error: "Invalid status" });

    const driver = await DriverModel.findOneAndUpdate(
        { id: req.driverId },
        { status },
        { new: true }
    );
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    return res.json({ success: true, status: driver.status });
};
