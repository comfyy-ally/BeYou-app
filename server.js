const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and URL-encoded data from forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve all static files (CSS, client-side JS, HTML files) from the current folder
app.use(express.static(__dirname));

// In-memory user database simulation (for a production app, connect this to a real database like MongoDB or PostgreSQL)
const users = [];

// 1. Root route: Always loads the Login/Lock screen first
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// 2. Registration API Endpoint
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already exists. Please choose another.' });
    }

    users.push({ username, password });
    return res.status(200).json({ success: true, message: 'Registration successful!' });
});

// 3. Login API Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    return res.status(200).json({ success: true, message: 'Login successful!' });
});

// 4. Fallback route for safety
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.listen(PORT, () => {
    console.log(`BeYou App server is running smoothly on port ${PORT}`);
});
