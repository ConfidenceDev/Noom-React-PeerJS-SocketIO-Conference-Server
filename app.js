import express from "express"
import http from "http"
import { ExpressPeerServer } from "peer"
import cors from "cors"
import { corsHeader } from "./serve.js"
import { Server } from "socket.io"

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
  },
})
const peerServer = ExpressPeerServer(server, {
  debug: true,
  allow_discovery: true,
})
const PORT = process.env.PORT || 443

app.use(cors(corsHeader))
app.use("/peerjs", peerServer)
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get("/", (req, res) => {
  res.sendStatus(200)
})

let roomPresentations = {}

io.on("connection", (socket) => {
  console.log("New User: " + socket.id)

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId)

    const room = io.sockets.adapter.rooms.get(roomId)
    const numberOfMembers = room ? room.size : 0

    socket.broadcast.to(roomId).emit("user-connected", userId)
    io.to(roomId).emit("nom", numberOfMembers)

    socket.on("mute-all", (value) => {
      socket.broadcast.to(roomId).emit("mute-all", value)
    })

    socket.on("userRecord", (id, data) => {
      socket.to(id).emit("userRecord", data)
    })

    socket.on("room-board-on", (roomId, userId) => {
      roomPresentations[roomId] = userId
      socket.broadcast
        .to(roomId)
        .emit("room-board-on", roomPresentations[roomId])
    })

    socket.on("room-board-off", (roomId, userId) => {
      if (roomPresentations[roomId] === userId) roomPresentations[roomId] = null
      socket.broadcast.to(roomId).emit("room-board-off", userId)
    })

    socket.on("message", (data) => {
      const obj = {
        msg: data.msg,
        username: data.username,
        img: data.img,
        userId: userId,
        date: new Date().toLocaleDateString("en-us", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
        }),
        utc: Date.now(),
      }
      io.to(roomId).emit("message", obj)
    })

    socket.on("disconnect", () => {
      socket.broadcast.to(roomId).emit("nom", numberOfMembers)
      socket.broadcast.to(roomId).emit("user-disconnected", userId)
    })

    socket.on("share", () => {
      socket.broadcast.to(roomId).emit("screen-share", userId)
    })
  })
})

server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
