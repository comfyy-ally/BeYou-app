const express = require('express');
const path = require('path');
const fs = require('fs');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Initialize Resend with your environment variable API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Path to persistent storage file for users
const USERS_FILE = path.join(__dirname, 'users.json');
const otpStorage = {};

// Helper function to read users from file
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Helper function to save users to file
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Step 1: Send Verification Code
app.post('/api/send-email-otp', async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const users = getUsers();
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username or email already exists!' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStorage[email] = { otp, username, password };

    try {
        const data = await resend.emails.send({
            from: 'TexUs App <onboarding@resend.dev>',
            to: [email],
            subject: 'Your TexUs Verification Code',
            html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: white; border-radius: 8px;">
                     <h2>TexUs Security Verification</h2>
                     <p>Your secure verification code is:</p>
                     <h1 style="color: #10b981; letter-spacing: 3px;">${otp}</h1>
                     <p style="font-size: 12px; color: #94a3b8;">If you didn't request this, please ignore this email.</p>
                   </div>`
        });

        console.log('Resend Response:', data);
        
        if (data.error) {
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

// Step 2: Verify Code and Permanently Save User
app.post('/api/verify-email-otp', (req, res) => {
    const { email, otp } = req.body;

    if (otpStorage[email] && otpStorage[email].otp === otp) {
        const { username, password } = otpStorage[email];
        
        const users = getUsers();
        users.push({ username, password, email });
        saveUsers(users); // Saves permanently to users.json file

        delete otpStorage[email];

        return res.status(200).json({ success: true, message: 'Verified successfully!' });
    }

    return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
});

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
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
