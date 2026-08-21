const express = require('express');
const path = require('path');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Replace these with your actual Twilio Credentials or set them as environment variables on Render
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'YOUR_TWILIO_ACCOUNT_SID';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'YOUR_TWILIO_AUTH_TOKEN';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || 'YOUR_TWILIO_PHONE_NUMBER';
const client = twilio(accountSid, authToken);

// Temporary in-memory databases
const users = [];
const otpStorage = {}; // Stores phone numbers and their temporary codes

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Step 1: Request OTP code via Twilio SMS
app.post('/api/send-otp', async (req, res) => {
    const { username, password, phone } = req.body;
    
    if (!username || !password || !phone) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already exists!' });
    }

    // Generate a random 4-digit code
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Save data and code temporarily mapped to the phone number
    otpStorage[phone] = { otp, username, password };

    try {
        // Send real SMS via Twilio
        await client.messages.create({
            body: `Your BeYou verification code is: ${otp}`,
            from: twilioPhoneNumber,
            to: phone
        });
        res.status(200).json({ success: true, message: 'OTP sent successfully!' });
    } catch (error) {
        console.error('Twilio Error:', error);
        res.status(500).json({ success: false, message: 'Failed to send SMS via Twilio.' });
    }
});

// Step 2: Verify OTP and finalize registration
app.post('/api/verify-otp', (req, res) => {
    const { phone, otp } = req.body;

    if (otpStorage[phone] && otpStorage[phone].otp === otp) {
        const { username, password } = otpStorage[phone];
        
        // Save user permanently
        users.push({ username, password, phone });
        
        // Clear the temporary storage
        delete otpStorage[phone];

        return res.status(200).json({ success: true, message: 'Phone verified successfully!' });
    }

    return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
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
