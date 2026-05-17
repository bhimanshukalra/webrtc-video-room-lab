import { Server } from "socket.io";
import express from "express";
import bodyParser from "body-parser";

const PORT = 8000;

const socketIo = new Server({
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const app = express();

app.use(bodyParser.json());

const emailToSocketMapping = new Map();
const socketToEmailMapping = new Map();

interface JoinRoomPayload {
  emailId: string;
  roomId: string;
}

interface CallUserPayload {
  emailId: string;
  offer: RTCSessionDescriptionInit;
}

interface CallAcceptedPayload {
  emailId: string;
  answer: RTCSessionDescriptionInit;
}

socketIo.on("connection", (socket) => {
  console.log("New connection");
  socket.on("join-room", ({ emailId, roomId }: JoinRoomPayload) => {
    emailToSocketMapping.set(emailId, socket.id);
    socketToEmailMapping.set(socket.id, emailId);
    socket.join(roomId);
    socket.emit("joined-room", { roomId });
    socket.broadcast.to(roomId).emit("user-joined", { emailId });
    console.log("room joined", emailId, roomId);
  });

  socket.on("call-user", ({ emailId, offer }: CallUserPayload) => {
    const fromEmail = socketToEmailMapping.get(socket.id);
    const socketId = emailToSocketMapping.get(emailId);
    socket.to(socketId).emit("incoming-call", { fromEmail, offer });
  });

  socket.on("call-accepted", ({ emailId, answer }: CallAcceptedPayload) => {
    const socketId = emailToSocketMapping.get(emailId);
    socket.to(socketId).emit("call-accepted", { answer });
  });
});

app.listen(PORT, () => console.log(`Node server running at ${PORT}`));
socketIo.listen(8001);
