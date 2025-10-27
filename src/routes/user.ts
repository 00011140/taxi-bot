import express from "express";
import { authenticate } from "../middlewares/auth";
// import { markArrived, startRide, endRide } from "../controllers/rideController";
import { requestRide } from "../controllers/userController";

const router = express.Router();

router.post("/request-ride", requestRide);
// router.post("/arrived", authenticate, markArrived);
// router.post("/start", authenticate, startRide);
// router.post("/end", authenticate, endRide);

export default router;
