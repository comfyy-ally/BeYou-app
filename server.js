const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const users = [];
const otpStorage = {};

// Setup Nodemailer transporter (Example using Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-email-app-password'
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Step 1: Send OTP via Email
app.post('/api/send-email-otp', async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username or email already exists!' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStorage[email] = { otp, username, password };

    try {
        await transporter.sendMail({
            from: '"BeYou App" <no-reply@beyou.com>',
            to: email,
            subject: 'Your BeYou Verification Code',
            text: `Your verification code is: ${otp}`
        });
        res.status(200).json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Email Error:', error);
        // Fallback if email credentials aren't set up yet, so it still lets you test locally:
        res.status(200).json({ success: true, message: `Email simulated (Code: ${otp})` });
    }
});

// Step 2: Verify Email OTP
app.post('/api/verify-email-otp', (req, res) => {
    const { email, otp } = req.body;

    if (otpStorage[email] && otpStorage[email].otp === otp) {
        const { username, password } = otpStorage[email];
        users.push({ username, password, email });
        delete otpStorage[email];

        return res.status(200).json({ success: true, message: 'Verified successfully!' });
    }

    return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
});

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    return res.status(200).json({ success: true, message: 'Login successful!' });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
