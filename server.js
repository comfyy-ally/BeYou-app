const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

// Middleware to parse incoming JSON requests
app.use(express.json());

// Serve static frontend files (like dashboard.html)
app.use(express.static(__dirname));

// Pull secret key safely from Render Environment Variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

/**
 * Bank Payout Endpoint
 * Sends ad earnings directly to a user's connected bank account via Stripe & Axios
 */
app.post('/api/withdraw-to-bank', async (req, res) => {
    const { stripeConnectedAccountId, amountInCents } = req.body;

    if (!stripeConnectedAccountId || !amountInCents) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required parameters: stripeConnectedAccountId and amountInCents are required.' 
        });
    }

    if (amountInCents <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Withdrawal amount must be greater than zero.' 
        });
    }

    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.stripe.com/v1/transfers',
            headers: {
                'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: new URLSearchParams({
                amount: amountInCents,
                currency: 'usd',
                destination: stripeConnectedAccountId
            }).toString()
        });

        return res.status(200).json({
            success: true,
            transferId: response.data.id,
            amountTransferred: response.data.amount / 100,
            message: 'Funds successfully transferred to your bank account.'
        });

    } catch (error) {
        console.error('Stripe Payout Error:', error.response ? error.response.data : error.message);
        
        const errorMessage = error.response && error.response.data && error.response.data.error
            ? error.response.data.error.message
            : 'Bank transfer request failed.';

        return res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// Serve dashboard on root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});