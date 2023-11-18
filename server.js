const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const { v4: uuidv4 } = require('uuid');
const db = require('./db'); // Import MongoDB connection
const User = require('./models/user'); // Import User model
const Message = require('./models/message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Use express session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Use connect-flash middleware
app.use(flash());

// Dummy user database (Replace this with MongoDB later)
const users = [
  // ... (your user objects)
];

// Passport Local Strategy
passport.use(new LocalStrategy(
    (username, password, done) => {
      User.findOne({ username: username }, (err, user) => {
        if (err) { return done(err); }
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
        }
        if (!user.validPassword(password)) {
          return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
      });
    }
  ));

// Passport Serialization and Deserialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Serve static files (like HTML)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

// Use the express.urlencoded middleware to parse form data
app.use(express.urlencoded({ extended: true }));

app.post('/login',
  passport.authenticate('local', { 
    successRedirect: '/', 
    failureRedirect: '/login', 
    failureFlash: true 
  }), 
  (req, res) => {
    res.redirect('/');
  }
);

// Socket.io connection handling
const typingUsers = {};


// Socket.io connection handling


io.on('connection', (socket) => {
  console.log('A user connected');

  // Generate a unique user ID using uuid
  const userId = uuidv4();

  // Emit the user ID to the connected client
  socket.emit('userId', userId);

  // Listen for chat messages from clients
  socket.on('chatMessage', (message) => {
    // Check if the message is a typing indicator
    if (message === '/typing') {
        // Set the user as typing
        typingUsers[socket.id] = true;
        // Broadcast typing indicator to other users
        socket.broadcast.emit('typingIndicator', { userId, username: users[socket.id], isTyping: true });
      } else if (message === '/clear') {
        // Clear chat messages
        io.emit('clearChat', { userId, username: 'System' });
      } else {
        if (typingUsers[socket.id]) {
          // Broadcast typing indicator off when a message is sent
          socket.broadcast.emit('typingIndicator', { userId, username: users[socket.id], isTyping: false });
          // Reset typing status
          typingUsers[socket.id] = false;
        }
      
      if (message.startsWith('/pm')) {
        // Private message format: /pm username message
        const pmRegex = /^\/pm (\w+) (.+)/;
        const match = message.match(pmRegex);
        if (match && match[1] && match[2]) {
          const targetUser = Object.entries(users).find(([id, username]) => username === match[1]);
          if (targetUser) {
            const [targetUserId] = targetUser;
            io.to(targetUserId).emit('chatMessage', { userId, username: 'Private Message', message: match[2] });
          } else {
            // Send an error message if the target user is not found
            socket.emit('chatMessage', { userId, username: 'System', message: `User "${match[1]}" not found` });
          }
        } else {
          // Send an error message if the private message format is incorrect
          socket.emit('chatMessage', { userId, username: 'System', message: 'Invalid private message format' });
        }
      } else {
        // Public message
        io.emit('chatMessage', { userId, username: users[socket.id], message });
      }
    }
  });

  // Listen for username updates from clients
  socket.on('updateUsername', (username) => {
    users[socket.id] = username;
    io.emit('chatMessage', { userId, username: 'System', message: `${username} has joined the chat` });
    io.emit('updateUserList', Object.values(users));
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    const disconnectedUser = users[socket.id] || 'Anonymous';
    delete users[socket.id];
    io.emit('chatMessage', { userId, username: 'System', message: `${disconnectedUser} has left the chat` });
    io.emit('updateUserList', Object.values(users));
  });
});
  
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
