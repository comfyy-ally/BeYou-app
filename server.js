const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Explicitly serve index.html for the root URL route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static frontend files (like CSS, images, client scripts)
app.use(express.static(path.join(__dirname)));

// API endpoint to log watch time or metrics
app.post('/api/log-watch', (req, res) => {
    const { userId, minutesWatched } = req.body;
    console.log(`[TexUs] User ${userId} watched for ${minutesWatched} minutes.`);
    res.status(200).json({ success: true, message: 'Watch time logged successfully.' });
});

app.listen(PORT, () => {
    console.log(`TexUs main server running on http://localhost:${PORT}`);
})