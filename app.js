import "dotenv/config.js";
import http from "http";
import { StreamChat } from "stream-chat";
import { corsPayload, corsHeader } from "./cors.js";
import express from "express";
import { Server } from "socket.io";
const app = express();
const server = http.createServer(app);

app.use(corsPayload);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
("");
const client = new StreamChat(apiKey, apiSecret);
const PORT = process.env.PORT || 5000;

/*const url = `https://decode-mnjh.onrender.com/api/admin/deleteMeeting/${roomId}`
const options = {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
    //'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
  },
}
removeMeetingRecord(url, options)
const removeMeetingRecord = async (url, options) => {
  try {
    const response = await fetch(url, options)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    //const data = await response.json();
    //console.log('Meeting removed successfully:', data);
  } catch (error) {
    console.error("Error removing meeting record:", error)
  }
}
*/

app.post("/auth", (req, res) => {
  const { userId } = req.body;
  console.log("USER-ID: " + userId);
  const token = client.createToken(userId);
  console.log("TOKEN: " + token);
  const name = userId;

  res.json({ userId, name, token });
});

const io = new Server(server, {
  cors: corsHeader,
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ roomId, user }) => {
    socket.join(roomId);
    console.log(`${user} joined room ${roomId}`);
  });

  socket.on("message", ({ roomId, message }) => {
    message.utc = new Date().toLocaleDateString("en-us", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
      timeZone: "Africa/Lagos",
    });
    io.to(roomId).emit("message", message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
