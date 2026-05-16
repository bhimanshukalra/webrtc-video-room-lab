import { Server } from "socket.io";
import express from "express";
import bodyParser from "body-parser";

const PORT = 8000;

const socketIo = new Server();
const app = express();

app.use(bodyParser.json());

socketIo.on("connection", (socket) => console.log("connected", socket));

app.listen(PORT, () => console.log(`Node server running at ${PORT}`));
