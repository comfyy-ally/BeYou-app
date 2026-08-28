const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

// Middleware to parse incoming JSON requests
app.use(express.json());

// Serve static frontend files (like dashboard.html) from current directory
app.use(express.static(__dirname));

// Environment Variables for PayPal Credentials
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
// Set to 'https://api-m.sandbox.paypal.com' for testing or 'https://api-m.paypal.com' for live production
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';

/**
 * Helper function to generate a PayPal OAuth Access Token
 */
async function getPayPalAccessToken() {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
        const response = await axios({
            method: 'post',
            url: `${PAYPAL_API_BASE}/v1/oauth2/token`,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: 'grant_type=client_credentials'
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching PayPal Access Token:', error.response ? error.response.data : error.message);
        throw new Error('PayPal authentication failed.');
    }
}

/**
 * PayPal Payout Endpoint
 * Sends funds directly to a user's PayPal email address
 */
app.post('/api/withdraw-to-paypal', async (req, res) => {
    let { paypalEmail, amountInDollars } = req.body;

    // 1. Basic Validation
    if (!paypalEmail || !amountInDollars) {
        return res.status(400).json({
            success: false,
            error: 'Missing required parameters: paypalEmail and amountInDollars are required.'
        });
    }

    // Convert comma to period if user entered '0,20' instead of '0.20'
    if (typeof amountInDollars === 'string') {
        amountInDollars = amountInDollars.replace(',', '.');
    }

    const amount = parseFloat(amountInDollars);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Withdrawal amount must be greater than zero.'
        });
    }

    try {
        // 2. Fetch Access Token from PayPal
        const accessToken = await getPayPalAccessToken();

        // 3. Construct Payout Request Payload
        const senderBatchId = `Payout_${Date.now()}`;
        const payoutPayload = {
            sender_batch_header: {
                sender_batch_id: senderBatchId,
                email_subject: "You received a payout from TexUs!",
                email_message: "Thank you for using TexUs. Your withdrawal has been processed successfully."
            },
            items: [
                {
                    recipient_type: "EMAIL",
                    amount: {
                        value: amount.toFixed(2),
                        currency: "USD"
                    },
                    note: "Payout for accumulated earnings.",
                    receiver: paypalEmail,
                    sender_item_id: `Item_${Date.now()}`
                }
            ]
        };

        // 4. Send Payout Request via PayPal REST API
        const response = await axios({
            method: 'post',
            url: `${PAYPAL_API_BASE}/v1/payments/payouts`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            data: payoutPayload
        });

        return res.status(200).json({
            success: true,
            payoutBatchId: response.data.batch_header.payout_batch_id,
            status: response.data.batch_header.batch_status,
            message: `Successfully initiated payout of $${amount.toFixed(2)} to ${paypalEmail}`
        });

    } catch (error) {
        console.error('PayPal Payout Error Details:', error.response ? error.response.data : error.message);

        // Extract specific error details returned by PayPal API
        let errorMessage = 'PayPal payout failed.';
        if (error.response && error.response.data) {
            const data = error.response.data;
            if (data.details && data.details.length > 0) {
                errorMessage = data.details.map(d => d.issue || d.description).join('; ');
            } else if (data.message) {
                errorMessage = data.message;
            }
        }

        return res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// Serve dashboard.html on root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Start server listening on allocated port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
