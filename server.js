const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./socketHandler'); // Your custom handler

const app = express();

// Health check or cold start prevention
app.get('/ping', (req, res) => {
  res.send("Pong from backend!");
});

// Create HTTP server
const server = http.createServer(app);

// Set up socket.io with proper CORS for Netlify + local dev
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:65101", // Local dev
      "glowing-dusk-316ea7.netlify.app" // Your hosted frontend
    ],
    methods: ["GET", "POST"],
  }
});

// WebSocket connection
io.on('connection', socket => {
  console.log(`✅ User connected: ${socket.id}`);
  socketHandler(io, socket);
});

// Use Render-supplied port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
