const express = require('express');
const Datastore = require('nedb-promises');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Secure Session Config
app.use(session({
  secret: 'texus_secret_key_987',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Databases
const usersDb = Datastore.create({ filename: './users.db', autoload: true });
const postsDb = Datastore.create({ filename: './posts.db', autoload: true });
const chatDb = Datastore.create({ filename: './chat.db', autoload: true });

// --- AUTHENTICATION ROUTES ---

// 1. Signup Route
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    const existingUser = await usersDb.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'Username is already taken!' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersDb.insert({ username, password: hashedPassword, createdAt: new Date() });

    res.json({ success: true, message: 'Account created! You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// 2. Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await usersDb.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid username or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid username or password.' });

    req.session.user = { id: user._id, username: user.username };
    res.json({ success: true, message: 'Logged in successfully!', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// 3. Logout Route
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out.' });
  });
});

// --- MAIN APP ROUTE ---
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TexUs</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background-color: #fafafa; color: #262626; display: flex; justify-content: center; }
        .main-wrapper { width: 100%; max-width: 450px; background: #fff; min-height: 100vh; border-left: 1px solid #dbdbdb; border-right: 1px solid #dbdbdb; padding-bottom: 60px; }
        header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #dbdbdb; background: #fff; position: sticky; top: 0; z-index: 10; }
        .logo { font-size: 24px; font-weight: bold; color: #e1306c; }
        .auth-container { padding: 15px; border-bottom: 1px solid #dbdbdb; background: #f9f9f9; text-align: center; }
        .auth-container input { width: 80%; padding: 8px; margin: 5px 0; border: 1px solid #ccc; border-radius: 4px; }
        .auth-container button { padding: 8px 15px; background-color: #0095f6; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 5px; }
        .create-post { padding: 15px; border-bottom: 1px solid #dbdbdb; }
        .create-post textarea { width: 100%; padding: 10px; border: 1px solid #dbdbdb; border-radius: 8px; resize: none; margin-top: 10px; }
        .create-post button { background: #0095f6; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 10px; width: 100%; }
        nav { position: fixed; bottom: 0; width: 100%; max-width: 450px; background: #fff; border-top: 1px solid #dbdbdb; display: flex; justify-content: space-around; padding: 12px 0; font-size: 20px; }
    </style>
</head>
<body>
    <div class="main-wrapper">
        <header>
            <div class="logo">TexUs</div>
            <div>
                <i class="far fa-heart" style="margin-right: 15px;"></i>
                <i class="far fa-paper-plane"></i>
            </div>
        </header>

        <div class="auth-container">
            <h3>Login / Create Account</h3>
            <input type="text" id="auth-username" placeholder="Username"><br>
            <input type="password" id="auth-password" placeholder="Password"><br>
            <button onclick="login()">Log In</button>
            <button onclick="signup()" style="background-color: #3897f0;">Sign Up</button>
        </div>

        <div class="create-post">
            <textarea id="postText" rows="3" placeholder="What's on your mind?"></textarea>
            <button onclick="alert('Logged in features coming live!')">Post</button>
        </div>

        <nav>
            <i class="fas fa-home"></i>
            <i class="fas fa-film"></i>
            <i class="far fa-comment"></i>
        </nav>
    </div>

    <script>
        async function signup() {
            const u = document.getElementById('auth-username').value;
            const p = document.getElementById('auth-password').value;
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            alert(data.message || data.error);
        }

        async function login() {
            const u = document.getElementById('auth-username').value;
            const p = document.getElementById('auth-password').value;
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            alert(data.message || data.error);
        }
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('TexUs server running on port ' + PORT);
});