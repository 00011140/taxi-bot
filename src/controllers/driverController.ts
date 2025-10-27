import { Request, Response } from "express";
import { DriverModel } from "../models/DriverModel";
import { RideModel } from "../models/Ride";
import { AuthRequest } from "../middlewares/auth";

export const updateLocation = async (req: AuthRequest, res: Response) => {
    const { lat, lon } = req.body;
    if (!lat || !lon) return res.status(400).json({ error: "lat/lon required" });

    const driver = await DriverModel.findOneAndUpdate(
        { id: req.driverId },
        { location: { lat, lon } },
        { new: true }
    );
    if (!driver) return res.status(404).json({ error: "Driver not found" });

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

export const acceptRide = async (req: AuthRequest, res: Response) => {
    const { rideId } = req.body;
    const ride = await RideModel.findOne({ id: rideId });
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    ride.driverId = req.driverId;
    ride.status = "accepted";
    await ride.save();

    await DriverModel.findOneAndUpdate(
        { id: req.driverId },
        { currentRideId: rideId }
    );

    return res.json({ success: true, message: "Ride accepted" });
};
