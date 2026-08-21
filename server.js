const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Automatically load stream.html when visiting the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'stream.html'));
});

// Helper files paths
const postsFile = path.join(__dirname, 'posts.json');

// Ensure storage files exist
if (!fs.existsSync(postsFile)) {
  fs.writeFileSync(postsFile, JSON.stringify([]));
}

// API to track watch time and save to file
app.post('/api/track-watch-time', (req, res) => {
  const { userId, minutesWatched } = req.body;
  const earningsPerMinute = 0.01; // Your rate per minute
  const totalEarned = minutesWatched * earningsPerMinute;

  try {
    const data = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
    data.push({
      userId,
      minutesWatched,
      earnings: totalEarned,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(postsFile, JSON.stringify(data, null, 2));

    console.log(`User ${userId} watched ${minutesWatched} mins. Earned: $${totalEarned.toFixed(2)}`);
    res.json({ success: true, totalEarned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`TexUs app is running on http://localhost:${PORT}`);
});
