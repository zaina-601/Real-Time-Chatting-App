const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const frontendURL = "https://real-time-chatting-app-alpha.vercel.app";
app.use(cors({ origin: frontendURL }));

app.get('/', (req, res) => {
  res.status(200).send('<h1>Real-Time Chat Server is running.</h1>');
});

mongoose.connect(
  "mongodb+srv://225186:8536675m@cluster0.002gnfa.mongodb.net/?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

const messageSchema = new mongoose.Schema({
  text: String,
  sender: String,
  recipient: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: frontendURL, methods: ["GET", "POST"] }
});

let users = [];

io.on('connection', (socket) => {
  console.log(`→ New socket connected: ${socket.id}`);

  socket.on('newUser', username => {
    console.log("newUser:", username);
    if (!username) return;
    if (!users.some(u => u.username === username)) {
      users.push({ id: socket.id, username });
      socket.broadcast.emit('userJoined', { id: socket.id, username });
    }
    io.emit('userList', users);
  });

  socket.on('getPrivateMessages', async ({ user1, user2 }) => {
    console.log("getPrivateMessages from", user1, "to", user2);
    const docs = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    }).sort({ timestamp: 1 });
    socket.emit('privateMessages', docs.map(d => d.toObject()));
  });

  socket.on('sendPrivateMessage', async data => {
    console.log("sendPrivateMessage received:", data);
    const { text, sender, recipient } = data;
    if (!text || !sender || !recipient) return;
    const saved = await new Message({ text, sender, recipient }).save();
    const msg = saved.toObject();

    socket.emit('receivePrivateMessage', msg);
    const recipientSocket = users.find(u => u.username === recipient);
    if (recipientSocket) {
      io.to(recipientSocket.id).emit('receivePrivateMessage', msg);
      console.log("→ Sent msg to", recipientSocket.username);
    }
  });

  // Add typing notifications
  socket.on('typing', ({ sender, recipient }) => {
    const rec = users.find(u => u.username === recipient);
    if (rec) io.to(rec.id).emit('userTyping', sender);
  });
  socket.on('stopTyping', ({ sender, recipient }) => {
    const rec = users.find(u => u.username === recipient);
    if (rec) io.to(rec.id).emit('userStoppedTyping', sender);
  });

  socket.on('disconnect', () => {
    console.log("Socket disconnected:", socket.id);
    users = users.filter(u => u.id !== socket.id);
    io.emit('userList', users);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
