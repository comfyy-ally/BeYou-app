const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('chat-message', (msg) => {
    io.emit('chat-message', msg); // Broadcasts message to all connected clients
  });
});

server.listen(3000, () => {
  console.log('Signaling server is running on http://localhost:3000');
});
