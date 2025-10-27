import express from "express";
import { authenticate } from "../middlewares/auth";
import { updateLocation, updateStatus, acceptRide } from "../controllers/driverController";

const router = express.Router();

router.post("/update-location", authenticate, updateLocation);
router.post("/status", authenticate, updateStatus);
router.post("/accept", authenticate, acceptRide);

export default router;
