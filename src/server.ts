import express from "express";
import { initSocketServer } from "./gateway/socket";
import http from "http";
import bodyParser from "body-parser";
import { makeDriverAuthController } from "./controllers/driverAuthController";
import { MongoDriverRepo } from "./infra/repos/MongoDriverRepo";
import { connectDB } from "./utils/db";
import dotenv from "dotenv";
import userRoutes from "./routes/user";

dotenv.config();

const app = express();
app.use(bodyParser.json());

async function startServer() {
    await connectDB();
    const server = http.createServer(app);
    initSocketServer(server);

    const driverRepo = new MongoDriverRepo();

    app.use("/user", userRoutes);
    app.use("/driver", makeDriverAuthController(driverRepo));

    // simple health check
    app.get("/health", (req, res) => res.send("ok"));

    const PORT = process.env.PORT ?? 3000;
    server.listen(PORT, () => console.log(`listening on ${PORT}`));

}

startServer();