const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve all your static files (HTML, CSS, JS) from the current folder
app.use(express.static(__dirname));

// Simple in-memory user list (stores registered users while server is running)
const users = [];

// 1. Force the root URL ('/') to load the Login/Lock screen first
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// 2. Handle Register Form Submissions
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already exists!' });
    }

    users.push({ username, password });
    return res.status(200).json({ success: true, message: 'Registered successfully!' });
});

// 3. Handle Login Form Submissions
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    return res.status(200).json({ success: true, message: 'Login successful!' });
});

// Fallback to login page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
