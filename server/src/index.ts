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
const socketToRoomMapping = new Map();

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

interface IceCandidatePayload {
  emailId: string;
  candidate: RTCIceCandidateInit;
}

interface MediaTogglePayload {
  emailId: string;
  kind: "audio" | "video";
  enabled: boolean;
}

const removeUserFromRoom = (socketId: string) => {
  const emailId = socketToEmailMapping.get(socketId);
  const roomId = socketToRoomMapping.get(socketId);

  if (emailId && roomId) {
    socketIo.to(roomId).except(socketId).emit("user-left", { emailId });
  }

  if (emailId) {
    emailToSocketMapping.delete(emailId);
  }

  socketToEmailMapping.delete(socketId);
  socketToRoomMapping.delete(socketId);
};

socketIo.on("connection", (socket) => {
  socket.on("join-room", ({ emailId, roomId }: JoinRoomPayload) => {
    emailToSocketMapping.set(emailId, socket.id);
    socketToEmailMapping.set(socket.id, emailId);
    socketToRoomMapping.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit("joined-room", { roomId });
    socket.broadcast.to(roomId).emit("user-joined", { emailId });
  });

  socket.on("call-user", ({ emailId, offer }: CallUserPayload) => {
    const fromEmail = socketToEmailMapping.get(socket.id);
    const socketId = emailToSocketMapping.get(emailId);
    if (!fromEmail || !socketId) {
      return;
    }

    socket.to(socketId).emit("incoming-call", { fromEmail, offer });
  });

  socket.on("call-accepted", ({ emailId, answer }: CallAcceptedPayload) => {
    const socketId = emailToSocketMapping.get(emailId);
    if (!socketId) {
      return;
    }

    socket.to(socketId).emit("call-accepted", { answer });
  });

  socket.on("ice-candidate", ({ emailId, candidate }: IceCandidatePayload) => {
    const socketId = emailToSocketMapping.get(emailId);
    if (!socketId) {
      return;
    }

    socket.to(socketId).emit("ice-candidate", { candidate });
  });

  socket.on(
    "media-toggle",
    ({ emailId, kind, enabled }: MediaTogglePayload) => {
      const socketId = emailToSocketMapping.get(emailId);
      if (!socketId) {
        return;
      }

      socket.to(socketId).emit("media-toggle", { kind, enabled });
    },
  );

  socket.on("leave-room", () => {
    const roomId = socketToRoomMapping.get(socket.id);
    if (roomId) {
      socket.leave(roomId);
    }

    removeUserFromRoom(socket.id);
  });

  socket.on("disconnect", () => {
    removeUserFromRoom(socket.id);
  });
});

app.listen(PORT, () => console.log(`Node server running at ${PORT}`));
socketIo.listen(8001);
