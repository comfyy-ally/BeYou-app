const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true
}));

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'beyou_super_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Serve Static Frontend Files (from your project directory or a 'public' folder)
app.use(express.static(path.join(__dirname, '.')));

// In-Memory Database Arrays (replaces MongoDB)
const users = [];
const messages = [];

// --- AUTHENTICATION ROUTES ---

// Signup Route
app.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user object
    const newUser = {
      _id: Date.now().toString(),
      name, 
      email, 
      phone, 
      password: hashedPassword,
      bio: '',
      followers: [],
      following: [],
      friendRequests: [],
      friends: []
    };
    
    users.push(newUser);

    // Log user in automatically
    req.session.userId = newUser._id;
    req.session.user = { id: newUser._id, name: newUser.name, email: newUser.email };

    res.status(201).json({ message: 'User registered and logged in successfully!' });
  } catch (err) {
    console.error('Signup error details:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user._id;
    req.session.user = { id: user._id, name: user.name, email: user.email };

    res.status(200).json({ message: 'Logged in successfully!' });
  } catch (err) {
    console.error('Login error details:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Logout Route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out successfully.' });
  });
});

// --- PROFILE ROUTE ---
app.get('/profile', (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const user = users.find(u => u._id === req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { password, ...userProfile } = user;
    res.status(200).json(userProfile);
  } catch (err) {
    console.error('Profile error details:', err);
    res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`BeYou server running on port ${PORT}`);
});