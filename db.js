// db.js

const mongoose = require('mongoose');
const username = 'User10';
const password = encodeURIComponent('@password123'); // URL-encode the password


const mongoURI = `mongodb+srv://${username}:${password}@cluster0.j9ise.mongodb.net/?retryWrites=true&w=majority`;

// Replace with your MongoDB URL
mongoose.connect(mongoURI);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

module.exports = db;
