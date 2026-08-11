const express = require('express');
const Datastore = require('nedb-promises');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup: Keeps users logged in for 1 WEEK (7 Days)
app.use(session({
  secret: 'texus_secret_key_987',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 Days in milliseconds
}));

// Databases
const usersDb = Datastore.create({ filename: './users.db', autoload: true });
const postsDb = Datastore.create({ filename: './posts.db', autoload: true });
const chatDb = Datastore.create({ filename: './chat.db', autoload: true });

// --- AUTHENTICATION API ROUTES ---

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
  req.session.destroy(() => res.json({ success: true }));
});

// 4. Fetch All Users Route
app.get('/api/users', async (req, res) => {
  try {
    const users = await usersDb.find({}, { password: 0 }); // Exclude passwords
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error loading users.' });
  }
});

// --- MAIN FRONTEND ROUTE ---
app.get('/', (req, res) => {
  const currentUser = req.session.user ? req.session.user.username : null;

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
        .main-wrapper { width: 100%; max-width: 450px; background: #fff; min-height: 100vh; border-left: 1px solid #dbdbdb; border-right: 1px solid #dbdbdb; position: relative; padding-bottom: 60px; }
        
        /* Auth Screen Styling */
        .auth-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; padding: 30px; text-align: center; background: #fff; }
        .auth-screen h1 { font-size: 38px; color: #e1306c; margin-bottom: 8px; font-weight: 800; }
        .auth-screen p { color: #8e8e8e; margin-bottom: 25px; font-size: 14px; }
        .auth-screen input { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #dbdbdb; border-radius: 6px; background: #fafafa; font-size: 14px; }
        .auth-screen button { width: 100%; padding: 12px; background-color: #0095f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; font-size: 14px; }
        .auth-screen .toggle-btn { background: transparent; color: #0095f6; margin-top: 15px; font-size: 13px; text-decoration: underline; border: none; cursor: pointer; }

        /* Main App Header */
        header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #dbdbdb; background: #fff; position: sticky; top: 0; z-index: 10; }
        .logo { font-size: 24px; font-weight: bold; color: #e1306c; }
        
        /* Views */
        .view-section { display: block; }
        .hidden { display: none !important; }

        /* Profile Section */
        .profile-card { text-align: center; padding: 25px 20px; border-bottom: 1px solid #dbdbdb; background: #fafafa; }
        .profile-avatar { width: 70px; height: 70px; border-radius: 50%; background: #e1306c; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; margin: 0 auto 10px; }
        .profile-username { font-size: 18px; font-weight: bold; }
        .profile-badge { font-size: 12px; color: #8e8e8e; margin-top: 4px; }
        .logout-btn { margin-top: 15px; padding: 6px 15px; background: #ed4956; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px; }

        /* User List / Feed */
        .user-list { padding: 15px; border-bottom: 1px solid #dbdbdb; }
        .user-card { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #eee; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 35px; height: 35px; border-radius: 50%; background: #3897f0; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
        .chat-btn { background: #0095f6; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; }

        /* Bottom Navigation */
        nav { position: fixed; bottom: 0; width: 100%; max-width: 450px; background: #fff; border-top: 1px solid #dbdbdb; display: flex; justify-content: space-around; padding: 12px 0; font-size: 20px; }
        nav i { cursor: pointer; color: #262626; }
    </style>
</head>
<body>
    <div class="main-wrapper">

    ${!currentUser ? `
        <div class="auth-screen" id="loginView">
            <h1>TexUs</h1>
            <p>Connect and text with people instantly.</p>
            <input type="text" id="login-u" placeholder="Username">
            <input type="password" id="login-p" placeholder="Password">
            <button onclick="login()">Log In</button>
            <button class="toggle-btn" onclick="toggleAuth('signup')">Don't have an account? Sign Up</button>
        </div>

        <div class="auth-screen" id="signupView" style="display: none;">
            <h1>TexUs</h1>
            <p>Join the TexUs community today.</p>
            <input type="text" id="signup-u" placeholder="Choose a Username">
            <input type="password" id="signup-p" placeholder="Choose a Password">
            <button onclick="signup()" style="background-color: #3897f0;">Create Account</button>
            <button class="toggle-btn" onclick="toggleAuth('login')">Already have an account? Log In</button>
        </div>
    ` : `
        <header>
            <div class="logo">TexUs</div>
            <i class="fas fa-sign-out-alt" onclick="logout()" style="cursor: pointer; font-size: 18px;" title="Logout"></i>
        </header>

        <div id="feedTab" class="view-section">
            <div class="user-list">
                <h4 style="margin-bottom: 10px;">TexUs Community</h4>
                <div id="usersContainer">Loading members...</div>
            </div>
        </div>

        <div id="profileTab" class="view-section hidden">
            <div class="profile-card">
                <div class="profile-avatar">${currentUser.charAt(0).toUpperCase()}</div>
                <div class="profile-username">@${currentUser}</div>
                <div class="profile-badge">Active TexUs Member</div>
                <button class="logout-btn" onclick="logout()">Log Out</button>
            </div>
        </div>

        <nav>
            <i class="fas fa-home" onclick="showTab('feedTab')"></i>
            <i class="far fa-paper-plane" onclick="alert('Inbox coming next!')"></i>
            <i class="far fa-user" onclick="showTab('profileTab')"></i>
        </nav>
    `}

    </div>

    <script>
        function toggleAuth(type) {
            document.getElementById('loginView').style.display = type === 'signup' ? 'none' : 'flex';
            document.getElementById('signupView').style.display = type === 'signup' ? 'flex' : 'none';
        }

        async function signup() {
            const u = document.getElementById('signup-u').value;
            const p = document.getElementById('signup-p').value;
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            alert(data.message || data.error);
            if (data.success) toggleAuth('login');
        }

        async function login() {
            const u = document.getElementById('login-u').value;
            const p = document.getElementById('login-p').value;
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            if (data.success) {
                location.reload();
            } else {
                alert(data.error);
            }
        }

        async function logout() {
            await fetch('/api/logout', { method: 'POST' });
            location.reload();
        }

        function showTab(tabId) {
            document.getElementById('feedTab').classList.add('hidden');
            document.getElementById('profileTab').classList.add('hidden');
            document.getElementById(tabId).classList.remove('hidden');
        }

        // Load active users list
        if (${JSON.stringify(!!currentUser)}) {
            fetch('/api/users')
                .then(res => res.json())
                .then(users => {
                    const container = document.getElementById('usersContainer');
                    if (users.length <= 1) {
                        container.innerHTML = '<p style="font-size: 13px; color: #8e8e8e;">No other members registered yet.</p>';
                        return;
                    }
                    container.innerHTML = users
                        .filter(u => u.username !== '${currentUser}')
                        .map(u => \`
                            <div class="user-card">
                                <div class="user-info">
                                    <div class="avatar">\${u.username.charAt(0).toUpperCase()}</div>
                                    <span>\${u.username}</span>
                                </div>
                                <button class="chat-btn" onclick="alert('Opening chat with ' + '\${u.username}')">Chat</button>
                            </div>
                        \`).join('');
                });
        }
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('TexUs server running on port ' + PORT);
});