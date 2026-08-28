const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve all static frontend files (HTML, CSS, JS) from the root or public directory
// If your HTML files are in the root directory alongside server.js, use __dirname:
app.use(express.static(__dirname));

/**
 * Payout API Endpoint
 * Handles creator daily withdrawal requests and responds with JSON.
 */
app.post('/api/withdraw-to-bank', async (req, res) => {
    try {
        const { stripeConnectedAccountId, amountInCents } = req.body;

        // Basic validation
        if (!stripeConnectedAccountId) {
            return res.status(400).json({ 
                success: false, 
                error: "Missing Stripe Connected Account ID." 
            });
        }

        if (!amountInCents || amountInCents <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid payout amount." 
            });
        }

        // Simulated success response for testing and deployment
        const simulatedTransferId = 'tr_' + Math.random().toString(36).substring(2, 12);

        return res.status(200).json({
            success: true,
            transferId: simulatedTransferId,
            message: `Successfully transferred funds to account ${stripeConnectedAccountId}`
        });

    } catch (error) {
        console.error("Payout error:", error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || "Internal server error during payout processing." 
        });
    }
});

// Fallback route for undefined API endpoints to prevent returning HTML pages
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: "API endpoint not found." });
});

// Catch-all route to serve index.html or handle SPA routing gracefully if needed
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`TexUs backend server is running on port ${PORT}`);
});
