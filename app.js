import express from "express"
import http from "http"
import { ExpressPeerServer } from "peer"
import cors from "cors"
import { corsHeader } from "./serve.js"
import { Server } from "socket.io"
import { Worker } from "node:worker_threads"
import fetch from "node-fetch"

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
const connectedUsers = new Map()
const roomDurations = new Map()
const kickedUsers = new Map()

io.on("connection", (socket) => {
  //console.log("New User: " + socket.id)
  //const recordId = socket.handshake.query.recordId
  //socket.id = recordId

  socket.on("start", (userId, instructorId, startDate, startTime) => {
    const { hours, minutes, seconds } = calcTimeToMeeting(startDate, startTime)
    if (hours > 0 || minutes > 0 || seconds > 0) {
      socket.emit(
        "occupied",
        true,
        `Meeting would begin in ${hours}hrs ${minutes}mins ${seconds}secs`
      )
      return
    }

    if (userId === instructorId && connectedUsers.has(userId)) {
      socket.emit("occupied", true, "Someone has joined as instructor already")
      return
    }

    if (userId === instructorId && !connectedUsers.has(userId)) {
      socket.emit("occupied", false)
      connectedUsers.set(userId, socket.id)
      return
    }

    /*if (!connectedUsers.has(instructorId)) {
      socket.emit(
        "occupied",
        true,
        "Please wait for instructor to join the meeting!"
      )
      return
    }*/

    if (connectedUsers.has(userId)) {
      socket.emit("occupied", true, "A User with this ID already exists")
      returnuserId
    }

    if (kickedUsers.has(userId)) {
      socket.emit(
        "occupied",
        true,
        "You've been restricted from joining this meeting!"
      )
      return
    }

    socket.emit("occupied", false)
    connectedUsers.set(userId, socket.id)
  })

  const calcTimeToMeeting = (startDate, startTime) => {
    const now = new Date()
    const utcYear = now.getUTCFullYear()
    const utcMonth = String(now.getUTCMonth() + 1).padStart(2, "0") // getUTCMonth() returns 0-11
    const utcDay = String(now.getUTCDate()).padStart(2, "0")
    const utcHour = String(now.getUTCHours() + 1).padStart(2, "0")
    const utcMinute = String(now.getUTCMinutes()).padStart(2, "0")
    const utcSeconds = String(now.getUTCSeconds()).padStart(2, "0")

    const myDate = `${utcYear}-${utcMonth}-${utcDay}`
    const myTime = `${utcHour}:${utcMinute}:${utcSeconds}`

    const bookedDateTimeString = `${startDate}T${startTime}`
    const myDateTimeString = `${myDate}T${myTime}`

    const bookedDateTime = new Date(bookedDateTimeString)
    const myDateTime = new Date(myDateTimeString)

    // Calculate the difference in milliseconds
    const differenceInMilliseconds = bookedDateTime - myDateTime

    // Convert the difference from milliseconds to hours, minutes, and seconds
    const differenceInSeconds = Math.floor(differenceInMilliseconds / 1000)
    const hours = Math.floor(differenceInSeconds / 3600)
    const minutes = Math.floor((differenceInSeconds % 3600) / 60)
    const seconds = differenceInSeconds % 60

    const result = {
      hours,
      minutes,
      seconds,
    }
    return result
  }

  socket.on("join-room", (roomId, userId, duration) => {
    socket.join(roomId)
    connectedUsers.set(userId, socket.id)

    const worker = new Worker("./worker.js")
    const room = io.sockets.adapter.rooms.get(roomId)
    const numberOfMembers = room ? room.size : 0

    socket.broadcast.to(roomId).emit("user-connected", socket.id)
    io.to(roomId).emit("nom", numberOfMembers)
    //let duration = 7200 // 2hrs
    /*const timerInterval = setInterval(() => {
      if (duration <= 0) {
        clearInterval(timerInterval)
        io.to(roomId).emit("timer", -1)
      } else {
        io.to(roomId).emit("timer", duration--)
      }
    }, 1000)*/

    duration = parseInt(duration) <= 0 ? 7200 : parseInt(duration)
    if (!roomDurations.has(roomId)) {
      worker.postMessage(duration)
      roomDurations.set(roomId, duration)
    }

    worker.on("message", (duration) => {
      if (duration <= 0) {
        roomDurations.delete(roomId)
        for (let [key, id] of kickedUsers.entries()) {
          if (id === roomId) {
            kickedUsers.delete(key)
          }
        }
        const url = `https://decode-mnjh.onrender.com/api/admin/deleteMeeting/${roomId}`
        const options = {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            //'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
          },
        }
        removeMeetingRecord(url, options)
        io.to(roomId).emit("timer", -1)
      } else {
        io.to(roomId).emit("timer", duration)
      }
    })

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

    socket.on("check-presentation", () => {
      if (
        roomPresentations[roomId] !== null &&
        roomPresentations[roomId] !== undefined
      ) {
        socket.emit("room-board-on", roomPresentations[roomId])
      }
    })

    socket.on("kick", (userId) => {
      for (let [key, id] of connectedUsers.entries()) {
        if (id === userId) {
          kickedUsers.set(key, roomId)
        }
      }
      socket.broadcast.to(roomId).emit("kick", userId)
    })

    socket.on("mute-all", (value) => {
      socket.broadcast.to(roomId).emit("mute-all", value)
    })

    socket.on("mute-me", (value) => {
      socket.broadcast.to(roomId).emit("mute-me", value)
    })

    socket.on("hide-me", (value) => {
      socket.broadcast.to(roomId).emit("hide-me", value)
    })

    socket.on("user-record", (id, data) => {
      io.to(id).emit("user-record", data)
    })

    socket.on("room-board-on", (roomId, userId) => {
      roomPresentations[roomId] = userId
      socket.broadcast
        .to(roomId)
        .emit("room-board-on", roomPresentations[roomId])
    })

    const closeBoard = (roomId, userId) => {
      if (roomPresentations[roomId] === userId) {
        roomPresentations[roomId] = null
        socket.broadcast.to(roomId).emit("room-board-off", userId)
      }
    }

    socket.on("room-board-off", (roomId, userId) => {
      closeBoard(roomId, userId)
    })

    socket.on("message", (data) => {
      const obj = {
        msg: data.msg,
        username: data.username,
        img: data.img,
        userId: socket.id,
        date: new Date().toLocaleDateString("en-us", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true,
          timeZone: "Africa/Lagos",
        }),
        utc: Date.now(),
      }
      io.to(roomId).emit("message", obj)
    })

    socket.on("disconnect", () => {
      const num = numberOfMembers > 1 ? numberOfMembers - 1 : numberOfMembers
      socket.broadcast.to(roomId).emit("nom", num)
      socket.broadcast.to(roomId).emit("user-disconnected", socket.id)
      closeBoard(roomId, userId)

      for (let [key, id] of connectedUsers.entries()) {
        if (id === socket.id) {
          connectedUsers.delete(key)
        }
      }
    })

    socket.on("share", () => {
      socket.broadcast.to(roomId).emit("screen-share", userId)
    })
  })
})

server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
