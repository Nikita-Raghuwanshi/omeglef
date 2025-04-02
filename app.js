const express = require("express");
const app = express();
const path = require("path");

const http = require("http");
const server = http.createServer(app);
const socketIo = require("socket.io");
const io = socketIo(server);
const { v4: uuidv4 } = require("uuid");

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (req, res) {
  res.render("index");
});

let users = [];
let waiting = [];
let room = {};
io.on("connection", function (socket) {
  socket.on("public-room", function (newuser) {
    const user = { id: socket.id, name: newuser };
    users.push(user);

    socket.join("public-room");
    io.to("public-room").emit("user-list", {
      users: users,
      room: "public-room",
    });
  });

  socket.on("joinRoom", function (newuser) {
    socket.data.user = { id: socket.id, name: newuser };

    if (waiting.length > 0) {
      let partner = waiting.shift();
      const roomname = uuidv4();
      socket.join(roomname);
      partner.join(roomname);
      io.to(roomname).emit("room joined", roomname);
    } else {
      waiting.push(socket);
    }
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("typing", { username: data.user });
  });

  socket.on("stop typing", (data) => {
    socket.to(data.room).emit("stop typing");
  });

  socket.on("chat message", (data) => {
    socket.to(data.room).emit("message", {
      room: data.room,
      msg: data.msg,
      userId: socket.id,
      username: data.username || "Anonymous",
    });
  });

  socket.on("startVideoCall", (room) => {
    // console.log(room);
    socket.broadcast.to(room).emit("incomingCall");
  });

  socket.on("signalingMessage", (data) => {
    // console.log(data)
    socket.to(data.room).emit("signalingMessage", data.message);
  });
  socket.on('cancelCall', (room) => {
    socket.broadcast.to(room).emit('callCancelled');
  });
  socket.on("acceptCall", (room) => {
    socket.broadcast.to(room).emit("callAccepted");
  });

  socket.on("rejectCall", (room) => {
    socket.broadcast.to(room).emit("callRejected");
  });

  socket.on('hangup', ( room ) => {
    socket.to(room).emit('hangup');
});
  socket.on("disconnect", function () {
    let userIndex = users.findIndex((user) => user.id === socket.id);
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
      io.to("public-room").emit("user-list", {
        users: users,
        room: "public-room",
      });
    }

    let waitingIndex = waiting.findIndex(
      (waitingUser) => waitingUser.id === socket.id
    );
    if (waitingIndex !== -1) {
      waiting.splice(waitingIndex, 1);
    }
  });
});

server.listen(3000);