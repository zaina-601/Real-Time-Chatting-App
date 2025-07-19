const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// --- HARDCODED URL: Direct Vercel URL yahan daal dein ---
const frontendURL = "https://real-time-chatting-app-alpha.vercel.app";

app.use(cors({ origin: frontendURL }));

// --- HARDCODED URI: Direct Mongo URI yahan daal dein ---
const mongoURI = "mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB connected successfully."))
  .catch(err => console.error("MongoDB connection error:", err));


const messageSchema = new mongoose.Schema({
  text: String,
  sender: String,
  recipient: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: frontendURL, // CORS ke liye bhi hardcoded URL
    methods: ["GET", "POST"],
  },
});

let users = [];

// Yahan se connection ka block shuru hota hai
io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on('newUser', (username) => {
    if (username && !users.some(u => u.username === username)) {
      const newUser = { id: socket.id, username };
      users.push(newUser);
      console.log(`${username} has joined the chat. Current users:`, users.map(u=>u.username));
      socket.broadcast.emit('userJoined', newUser);
    }
    io.emit('userList', users);
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    try {
      const messages = await Message.find({
        $or: [
          { sender: user1, recipient: user2 },
          { sender: user2, recipient: user1 }
        ]
      }).sort({ timestamp: 1 });
      socket.emit('privateMessages', messages);
    } catch (error) {
      console.error("Error fetching private messages:", error);
    }
  });

  socket.on('sendPrivateMessage', async (data) => {
    console.log("SERVER: Received 'sendPrivateMessage' event with data:", data);
    const { text, sender, recipient } = data;
    const recipientSocket = users.find(user => user.username === recipient);
    const newMessage = new Message({ text, sender, recipient });

    try {
      await newMessage.save();
      console.log("SERVER: Message saved to database successfully.");
      if (recipientSocket) {
        console.log(`SERVER: Sending message to recipient: ${recipient}`);
        io.to(recipientSocket.id).emit('receivePrivateMessage', newMessage);
      }
      console.log(`SERVER: Sending message back to sender: ${sender}`);
      socket.emit('receivePrivateMessage', newMessage);
    } catch (error) {
      console.error('SERVER ERROR: Could not save or send message:', error);
    }
  });
  
  socket.on('typing', ({ sender, recipient }) => {
    const recipientSocket = users.find(user => user.username === recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('userTyping', sender);
    }
  });

  socket.on('stopTyping', ({ sender, recipient }) => {
    const recipientSocket = users.find(user => user.username === recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('userStoppedTyping', sender);
    }
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`${disconnectedUser.username} disconnected`);
      users = users.filter(user => user.id !== socket.id);
      io.emit('userList', users);
    }
  });
  
}); // <-- Connection ka block yahan aakhir mein band ho raha hai.

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});