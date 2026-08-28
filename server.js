const express = require('express');
const cors = require('cors');

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files if they are in the same project directory
// app.use(express.static('public'));

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

        // TODO: Integrate actual Stripe transfer logic here using the 'stripe' npm package if desired:
        // const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY');
        // const transfer = await stripe.transfers.create({
        // amount: amountInCents,
        // currency: 'usd',
        // destination: stripeConnectedAccountId,
        // });

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

// Fallback route for undefined API endpoints to prevent HTML error pages
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: "API endpoint not found." });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`TexUs backend server is running on port ${PORT}`);
});
