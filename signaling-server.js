const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('TexUs user connected for calls:', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.id);
    });

    socket.on('offer', (data) => {
        socket.to(data.room).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        socket.to(data.room).emit('answer', data.answer);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.room).emit('ice-candidate', data.candidate);
    });

    socket.on('disconnect', () => {
        console.log('TexUs user disconnected from calls:', socket.id);
    });
});

const SIGNAL_PORT = 3001;
server.listen(SIGNAL_PORT, () => {
    console.log(`TexUs signaling server running on http://localhost:${SIGNAL_PORT}`);
});
