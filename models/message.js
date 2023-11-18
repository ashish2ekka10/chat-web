// models/message.js

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: String,
  username: String,
  message: String,
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
