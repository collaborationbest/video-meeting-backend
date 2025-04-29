const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer();
let wss = new WebSocket.Server({ server }); // Initialize WebSocket server
// Store active rooms and their participants
const rooms = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { type, roomId, userId } = data;

      switch (type) {
        case 'join':
          handleJoin(ws, roomId, userId);
          break;
        case 'offer':
          handleOffer(ws, data);
          break;
        case 'answer':
          handleAnswer(ws, data);
          break;
        case 'ice-candidate':
          handleIceCandidate(ws, data);
          break;
        case 'leave':
          handleLeave(ws, roomId, userId);
          break;
        case 'get-participants':
          handleGetParticipants(ws, roomId, userId);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    // Clean up when a client disconnects
    for (const [roomId, participants] of rooms.entries()) {
      const participant = Array.from(participants.entries()).find(([_, ws]) => ws === ws);
      if (participant) {
        handleLeave(ws, roomId, participant[0]);
      }
    }
  });
});

function handleJoin(ws, roomId, userId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  const room = rooms.get(roomId);
  room.set(userId, ws);

  // Notify all participants in the room about the new user
  room.forEach((participantWs, participantId) => {
    if (participantId !== userId) {
      participantWs.send(JSON.stringify({
        type: 'joined',
        userId,
        roomId
      }));
    }
  });

  console.log(`User ${userId} joined room ${roomId}`);
}

function handleOffer(ws, data) {
  const { roomId, target, offer, from } = data;
  const room = rooms.get(roomId);
  if (room && room.has(target)) {
    room.get(target).send(JSON.stringify({
      type: 'offer',
      offer,
      from,
      target
    }));
  }
}

function handleAnswer(ws, data) {
  const { roomId, target, answer, from } = data;
  const room = rooms.get(roomId);
  if (room && room.has(target)) {
    room.get(target).send(JSON.stringify({
      type: 'answer',
      answer,
      from,
      target
    }));
  }
}

function handleIceCandidate(ws, data) {
  const { roomId, target, candidate, from } = data;
  const room = rooms.get(roomId);
  if (room && room.has(target)) {
    room.get(target).send(JSON.stringify({
      type: 'ice-candidate',
      candidate,
      from,
      target
    }));
  }
}

function handleLeave(ws, roomId, userId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(userId);

    // Notify remaining participants
    room.forEach((participantWs, participantId) => {
      participantWs.send(JSON.stringify({
        type: 'left',
        userId,
        roomId
      }));
    });

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
}

function handleGetParticipants(ws, roomId, userId) {
  const room = rooms.get(roomId);
  if (room) {
    const participants = Array.from(room.keys());
    ws.send(JSON.stringify({
      type: 'participants',
      participants
    }));
  }
}

const PORT = process.env.PORT || 8081;

// Export the server as a Vercel function
module.exports = (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running');
  } else {
    server.emit('request', req, res); // Handle WebSocket connections
  }
}; 