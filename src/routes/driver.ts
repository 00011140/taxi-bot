import express from "express";
import { authenticateDriver } from "../middlewares/auth";
import { updateLocation, updateStatus } from "../controllers/driverController";

const router = express.Router();

router.post("/update-location", authenticateDriver, updateLocation);
router.post("/status", authenticateDriver, updateStatus);
// router.post("/accept", authenticateDriver, acceptRide);

export default router;
