//socketHandler.js

const waitingUsers = new Map();
const activePairs = new Map();
const activeVideoCalls = new Set(); // Track active video calls

module.exports = (io, socket) => {
  socket.on('user-details', ({ gender, interest }) => {
    socket.data = { gender, interest };
    console.log(`User ${socket.id} joined with gender: ${gender}, interest: ${interest}`);

    // If this user was in a previous chat, clean up first
    cleanupUserConnections(socket.id);

    for (let [id, otherSocket] of waitingUsers) {
      if (id === socket.id) continue;

      if (
        otherSocket.data &&
        otherSocket.data.gender === interest &&
        otherSocket.data.interest === gender
      ) {
        waitingUsers.delete(id);
        const matchedSocket = io.sockets.sockets.get(id);

        if (matchedSocket && matchedSocket.emit) {
          matchedSocket.emit('match-found', { matched: true, socketId: socket.id });
          socket.emit('match-found', { matched: true, socketId: matchedSocket.id });

          // Store active pair
          activePairs.set(socket.id, matchedSocket.id);
          activePairs.set(matchedSocket.id, socket.id);

          console.log(`🎯 Match found: ${socket.id} <--> ${matchedSocket.id}`);
        }
        return;
      }
    }

    waitingUsers.set(socket.id, socket);
    console.log(`User ${socket.id} added to waiting list.`);
  });

  socket.on('send-message', (message, toSocketId) => {
    const targetSocket = io.sockets.sockets.get(toSocketId);
    if (targetSocket) {
      targetSocket.emit('receive-message', message);
    }
  });

  socket.on('disconnect-chat', (partnerSocketId) => {
    const partnerSocket = io.sockets.sockets.get(partnerSocketId);

    // End any active video call
    if (activeVideoCalls.has(`${socket.id}-${partnerSocketId}`) ||
      activeVideoCalls.has(`${partnerSocketId}-${socket.id}`)) {
      handleVideoCallEnd(socket.id, partnerSocketId);
    }

    // Notify both users
    if (partnerSocket) {
      partnerSocket.emit('disconect', "Partner disconnected. Press find user to find a new match.");
    }

    socket.emit('disconect', "You disconnected. Press find user to find a new match.");

    // Add users back to waiting pool if they're still connected
    if (partnerSocket) {
      waitingUsers.set(partnerSocketId, partnerSocket);
    }
    waitingUsers.set(socket.id, socket);

    // Remove active pair
    activePairs.delete(socket.id);
    activePairs.delete(partnerSocketId);
  });

  socket.on('disconnect', () => {
    cleanupUserConnections(socket.id);
  });

  // Video chat handlers
  socket.on("video-offer", (offer, toSocketId) => {
    const target = io.sockets.sockets.get(toSocketId);
    if (target) {
      console.log(`Forwarding video offer from ${socket.id} to ${toSocketId}`);
      target.emit("video-offer", offer, socket.id);
      activeVideoCalls.add(`${socket.id}-${toSocketId}`);
    }
  });

  socket.on("video-answer", (answer, toSocketId) => {
    const target = io.sockets.sockets.get(toSocketId);
    if (target) {
      console.log(`Forwarding video answer from ${socket.id} to ${toSocketId}`);
      target.emit("video-answer", answer);
    }
  });

  socket.on("ice-candidate", (candidate, toSocketId) => {
    const target = io.sockets.sockets.get(toSocketId);
    if (target) {
      target.emit("ice-candidate", candidate);
    }
  });

  socket.on("start-call", (partnerId) => {
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      console.log(`User ${socket.id} initiated call with ${partnerId}`);
      partnerSocket.emit("start-video", socket.id);
      activeVideoCalls.add(`${socket.id}-${partnerId}`);
    }
  });

  socket.on("end-call", (partnerId) => {
    handleVideoCallEnd(socket.id, partnerId);
  });

  // Helper function to clean up user connections
  function cleanupUserConnections(userId) {
    waitingUsers.delete(userId);
    const partnerId = activePairs.get(userId);

    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('disconect', "Partner disconnected unexpectedly. Press find user to find a new match.");
      }

      // End any active video call
      handleVideoCallEnd(userId, partnerId);

      activePairs.delete(partnerId);
      activePairs.delete(userId);
    }

    // Clean up any remaining video calls
    for (const callId of activeVideoCalls) {
      if (callId.includes(userId)) {
        activeVideoCalls.delete(callId);
      }
    }
  }

  // Helper function to handle video call ending
  function handleVideoCallEnd(userId, partnerId) {
    activeVideoCalls.delete(`${userId}-${partnerId}`);
    activeVideoCalls.delete(`${partnerId}-${userId}`);

    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      console.log(`Ending video call between ${userId} and ${partnerId}`);
      partnerSocket.emit("end-video");
    }
  }
};