const express = require('express');
const path = require('path');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Initialize Resend with your environment variable API key
const resend = new Resend(process.env.RESEND_API_KEY);

const users = [];
const otpStorage = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Step 1: Send Verification Code
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
        // Attempt to send via Resend API to real inbox
        const data = await resend.emails.send({
            from: 'BeYou App <onboarding@resend.dev>',
            to: [email],
            subject: 'Your BeYou Verification Code',
            html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: white; border-radius: 8px;">
                     <h2>BeYou Security Verification</h2>
                     <p>Your secure verification code is:</p>
                     <h1 style="color: #10b981; letter-spacing: 3px;">${otp}</h1>
                     <p style="font-size: 12px; color: #94a3b8;">If you didn't request this, please ignore this email.</p>
                   </div>`
        });

        console.log('Resend Response:', data);
        
        // If Resend returns an error object
        if (data.error) {
            console.log('API Restriction Notice - Displaying code locally for test safety:', otp);
            return res.status(200).json({ 
                success: true, 
                fallbackCode: otp, 
                message: `Notice: Free tier restricts external emails. Use code: ${otp}` 
            });
        }

        return res.status(200).json({ success: true, message: 'Verification email sent successfully to your inbox!' });
    } catch (error) {
        console.error('Email sending exception:', error);
        return res.status(200).json({ 
            success: true, 
            fallbackCode: otp, 
            message: `Generated Code (Sandbox Mode): ${otp}` 
        });
    }
});

// Step 2: Verify Code and Save User
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
