const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory database simulation
const usersDatabase = []; // Stores { username, email, phone }
const verificationCodes = {}; // Stores active OTP codes by phone

app.use(express.static(path.join(__dirname)));

// Default route goes to Login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Register Endpoint
app.post('/api/register', (req, res) => {
    const { username, email, phone } = req.body;

    // Check if user already exists
    const existingUser = usersDatabase.find(u => u.phone === phone || u.email === email);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Account with this email or phone already exists!' });
    }

    usersDatabase.push({ username, email, phone });
    console.log(`[TexUs Database] New user registered: ${username} (${phone})`);
    res.status(200).json({ success: true, message: 'Account created successfully!' });
});

// Login / Send OTP Endpoint
app.post('/api/login-send-otp', (req, res) => {
    const { phone } = req.body;

    // Check if user is registered
    const userExists = usersDatabase.find(u => u.phone === phone);
    if (!userExists) {
        return res.status(404).json({ success: false, message: 'Phone number not found. Please create an account first.' });
    }

    // Generate random 4-digit code
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    verificationCodes[phone] = randomCode;

    console.log(`[TexUs SMS Gateway] Generated verification code ${randomCode} for ${phone}`);
    res.status(200).json({ success: true, debugCode: randomCode });
});

// Verify OTP Endpoint
app.post('/api/verify-login', (req, res) => {
    const { phone, code } = req.body;

    if (verificationCodes[phone] && verificationCodes[phone] === code) {
        delete verificationCodes[phone];
        res.status(200).json({ success: true, message: 'Login successful!' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }
});

app.listen(PORT, () => {
    console.log(`TexUs main server running on http://localhost:${PORT}`);
})