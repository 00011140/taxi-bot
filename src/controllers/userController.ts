// src/controllers/userController.ts
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { RideModel } from "../models/Ride";
import { DriverModel } from "../models/DriverModel";
import { haversineDistanceKm } from "../utils/haversine";
import { sendRideOffer } from "../gateway/socket";

/**
 * POST /user/request-ride
 * body: { chatId: number, location: { lat, lon }, dropoff?: {lat,lon}, address?: string }
 */
export const requestRide = async (req: Request, res: Response) => {
    console.log(`RIDE REQUESTED}`)
    try {
        const { chatId, location, dropoff, address } = req.body;
        if (!chatId || !location || typeof location.lat !== "number" || typeof location.lon !== "number") {
            return res.status(400).json({ error: "chatId and location required" });
        }

        // create a pending ride
        // const rideId = uuidv4();
        const rideDoc = await RideModel.create({
            userChatId: chatId,
            pickup: { lat: location.lat, lon: location.lon, address },
            dropoff: dropoff ? { lat: dropoff.lat, lon: dropoff.lon, address: dropoff.address } : undefined,
            status: "pending",
            fareEstimate: undefined,
        });
        console.log(`rideDoc: ${rideDoc}`)

        // find available drivers (online and not on a ride)
        const drivers = await DriverModel.find({ status: "online", currentRideId: { $in: [null, undefined] } }).lean();
        console.log(`Drivers: ${drivers}`)
        if (!drivers || drivers.length === 0) {
            return res.status(200).json({ message: "No drivers available", rideId: rideDoc._id });
        }
        console.log(`Drivers: ${drivers}`)

        // compute distances and pick the nearest driver
        const distances = drivers.map((d) => {
            const dKm = haversineDistanceKm(location.lat, location.lon, d.location?.lat ?? 0, d.location?.lon ?? 0);
            return { driver: d, distKm: dKm };
        }).sort((a, b) => a.distKm - b.distKm);

        const nearest = distances[0];
        const MAX_OFFER_KM = 10; // configurable radius
        if (nearest.distKm > MAX_OFFER_KM) {
            // optional: no drivers in radius
            return res.status(200).json({ message: "No drivers in range", rideId: rideDoc._id });
        }

        // update ride to mark as offered (driver not yet accepted)
        rideDoc.status = "offered";
        rideDoc.fareEstimate = calculateEstimate(nearest.distKm); // small helper below
        await rideDoc.save();

        // prepare ride payload for driver
        const offerPayload = {
            id: rideDoc.id,
            pickup: rideDoc.pickup,
            dropoff: rideDoc.dropoff,
            fareEstimate: rideDoc.fareEstimate,
            userChatId: rideDoc.userChatId,
            approxDistanceKm: nearest.distKm,
        };
        console.log(`offerPayload: ${offerPayload}`)

        const sent = sendRideOffer(nearest.driver.id, offerPayload);
        console.log(`RIDE OFFER SENT: ${sent}`)
        if (!sent) {
            // driver not connected — failover: try next nearest
            const available = distances.slice(1);
            for (const cand of available) {
                const ok = sendRideOffer(cand.driver.id, offerPayload);
                if (ok) break;
            }
        }

        return res.json({ rideId: rideDoc._id, message: "Haydovchi topildi, qabul qilish kutilyapti..." });
    } catch (err: any) {
        console.error("requestRide error:", err);
        return res.status(500).json({ error: "Internal error" });
    }
};

// very simple fare estimate function (you can replace with real pricing)
function calculateEstimate(distanceKm: number): number {
    const baseFare = 3;
    const perKm = 1.5;
    return parseFloat((baseFare + distanceKm * perKm).toFixed(2));
}
