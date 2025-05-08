const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./socketHandler'); // Handles WebSocket communication
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});

// Serve static files (frontend)


io.on('connection', socket => {
  console.log(`User connected: ${socket.id}`);
  socketHandler(io, socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
