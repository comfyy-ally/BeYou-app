const express = require('express');
const Datastore = require('nedb-promises');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup: Keeps users logged in Facebook-style for 1 WEEK (7 Days)
app.use(session({
  secret: 'texus_secret_key_987',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
  }
}));

// Databases
const usersDb = Datastore.create({ filename: './users.db', autoload: true });
const postsDb = Datastore.create({ filename: './posts.db', autoload: true });
const chatDb = Datastore.create({ filename: './chat.db', autoload: true });
const friendsDb = Datastore.create({ filename: './friends.db', autoload: true });

// --- AUTHENTICATION API ROUTES ---

app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    const existingUser = await usersDb.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'This account already exists! Please log in instead.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersDb.insert({ 
      username, 
      password: hashedPassword, 
      bio: 'Hey there! I am using TexUs.',
      location: 'Not specified',
      avatarUrl: '',
      createdAt: new Date() 
    });

    res.json({ success: true, message: 'Account created successfully! You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await usersDb.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Account not found. Check your username or sign up.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password.' });

    req.session.user = { id: user._id, username: user.username };
    res.json({ success: true, message: 'Welcome back!', username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// --- PROFILE & SETTINGS ROUTES ---

app.get('/api/profile', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const user = await usersDb.findOne({ username: req.session.user.username }, { password: 0 });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching profile.' });
  }
});

app.post('/api/profile/update', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const { bio, location, avatarUrl } = req.body;

  try {
    await usersDb.update(
      { username: req.session.user.username },
      { $set: { bio, location, avatarUrl } }
    );
    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// --- FRIENDS & MEMBERS ROUTES ---

app.get('/api/members', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const currentUser = req.session.user.username;

  try {
    const allUsers = await usersDb.find({ username: { $ne: currentUser } }, { password: 0 });
    const userFriends = await friendsDb.find({
      $or: [
        { requester: currentUser },
        { recipient: currentUser }
      ]
    });

    const membersWithStatus = allUsers.map(u => {
      const isFriend = userFriends.some(
        f => (f.requester === u.username || f.recipient === u.username) && f.status === 'accepted'
      );
      return { ...u, isFriend };
    });

    res.json(membersWithStatus);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching members.' });
  }
});

app.post('/api/add-friend', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const requester = req.session.user.username;
  const { recipient } = req.body;

  try {
    const existing = await friendsDb.findOne({
      $or: [
        { requester, recipient },
        { requester: recipient, recipient: requester }
      ]
    });

    if (existing) {
      return res.json({ success: true, message: 'Friend request already sent or connected!' });
    }

    await friendsDb.insert({ requester, recipient, status: 'accepted', createdAt: new Date() });
    res.json({ success: true, message: `You are now friends with ${recipient}!` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add friend.' });
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
        .main-wrapper { width: 100%; max-width: 450px; background: #fff; min-height: 100vh; border-left: 1px solid #dbdbdb; border-right: 1px solid #dbdbdb; position: relative; padding-bottom: 70px; }
        
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

        /* Profile Card */
        .profile-card { text-align: center; padding: 25px 20px; border-bottom: 1px solid #dbdbdb; background: #fafafa; }
        .profile-avatar-container { width: 80px; height: 80px; border-radius: 50%; background: #e1306c; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; margin: 0 auto 10px; overflow: hidden; border: 2px solid #dbdbdb; }
        .profile-avatar-container img { width: 100%; height: 100%; object-fit: cover; }
        .profile-username { font-size: 20px; font-weight: bold; }
        .profile-location { font-size: 12px; color: #8e8e8e; margin-top: 3px; }
        .profile-bio { font-size: 14px; color: #333; margin: 12px 0; padding: 0 15px; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #eee; text-align: left; }
        
        /* Settings Form */
        .settings-form { padding: 20px; text-align: left; }
        .settings-form label { font-size: 12px; font-weight: bold; color: #8e8e8e; display: block; margin-top: 10px; }
        .settings-form input, .settings-form textarea { width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #dbdbdb; border-radius: 6px; font-size: 14px; }
        .save-btn { width: 100%; margin-top: 15px; padding: 10px; background: #0095f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .logout-btn { width: 100%; margin-top: 20px; padding: 10px; background: #ed4956; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }

        /* Messages & Invite Box */
        .messages-container { padding: 20px; text-align: center; }
        .invite-box { background: #f0f8ff; border: 1px solid #b0e0e6; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: left; }
        .invite-box h4 { color: #0077cc; margin-bottom: 8px; }
        .invite-box p { font-size: 13px; color: #555; margin-bottom: 12px; }
        .invite-link-input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; background: #fff; margin-bottom: 10px; }
        .invite-btn { width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }

        /* Members Directory */
        .user-list { padding: 15px; }
        .user-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #eee; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; background: #3897f0; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; overflow: hidden; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .add-btn { background: #0095f6; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: bold; }
        .friend-badge { background: #eef7ee; color: #2e7d32; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }

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
            <p>Log in with your existing account</p>
            <input type="text" id="login-u" placeholder="Username">
            <input type="password" id="login-p" placeholder="Password">
            <button onclick="login()">Log In</button>
            <button class="toggle-btn" onclick="toggleAuth('signup')">New here? Create an account</button>
        </div>

        <div class="auth-screen" id="signupView" style="display: none;">
            <h1>TexUs</h1>
            <p>Create your account once to join TexUs.</p>
            <input type="text" id="signup-u" placeholder="Choose a Username">
            <input type="password" id="signup-p" placeholder="Choose a Password">
            <button onclick="signup()" style="background-color: #3897f0;">Sign Up</button>
            <button class="toggle-btn" onclick="toggleAuth('login')">Already have an account? Log In</button>
        </div>
    ` : `
        <header>
            <div class="logo">TexUs</div>
            <i class="fas fa-cog" onclick="showTab('settingsTab')" style="cursor: pointer; font-size: 18px;" title="Settings"></i>
        </header>

        <div id="membersTab" class="view-section">
            <div class="user-list">
                <h3 style="margin-bottom: 12px;">Find Friends on TexUs</h3>
                <div id="membersContainer">Loading members...</div>
            </div>
        </div>

        <div id="messagesTab" class="view-section hidden">
            <div class="messages-container">
                <div class="invite-box">
                    <h4><i class="fas fa-user-plus"></i> Invite Friends to TexUs</h4>
                    <p>Share this link with your friends so they can join you on TexUs:</p>
                    <input type="text" class="invite-link-input" id="inviteLinkText" value="https://beyou-app.onrender.com" readonly>
                    <button class="invite-btn" onclick="copyInviteLink()"><i class="fas fa-copy"></i> Copy Invite Link</button>
                </div>
                <div style="color: #8e8e8e; font-size: 13px; margin-top: 30px;">
                    <i class="far fa-paper-plane" style="font-size: 30px; margin-bottom: 10px; display: block;"></i>
                    Your direct messaging inbox is ready for chats!
                </div>
            </div>
        </div>

        <div id="profileTab" class="view-section hidden">
            <div class="profile-card">
                <div class="profile-avatar-container" id="profileAvatarDisplay">
                    ${currentUser.charAt(0).toUpperCase()}
                </div>
                <div class="profile-username">@${currentUser}</div>
                <div class="profile-location" id="displayLocation">Location not set</div>
                <div class="profile-bio" id="displayBio">Loading bio...</div>
                <button onclick="showTab('settingsTab')" style="padding: 8px 18px; background: #0095f6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">Edit Profile & Bio</button>
            </div>
        </div>

        <div id="settingsTab" class="view-section hidden">
            <div class="settings-form">
                <h3>Edit Profile & Settings</h3>
                
                <label>PROFILE PICTURE (IMAGE URL)</label>
                <input type="text" id="editAvatar" placeholder="Paste image web address (URL)">

                <label>ABOUT ME / BIO</label>
                <textarea id="editBio" rows="3" placeholder="Tell us about yourself..."></textarea>
                
                <label>LOCATION</label>
                <input type="text" id="editLocation" placeholder="e.g. New York, USA">

                <button class="save-btn" onclick="updateProfile()">Save Changes</button>
                <button class="logout-btn" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Log Out of TexUs</button>
            </div>
        </div>

        <nav>
            <i class="fas fa-users" onclick="showTab('membersTab')" title="Members"></i>
            <i class="far fa-paper-plane" onclick="showTab('messagesTab')" title="Messages"></i>
            <i class="far fa-user" onclick="showTab('profileTab')" title="Profile"></i>
            <i class="fas fa-cog" onclick="showTab('settingsTab')" title="Settings"></i>
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
            document.getElementById('membersTab').classList.add('hidden');
            document.getElementById('messagesTab').classList.add('hidden');
            document.getElementById('profileTab').classList.add('hidden');
            document.getElementById('settingsTab').classList.add('hidden');
            document.getElementById(tabId).classList.remove('hidden');
        }

        function copyInviteLink() {
            const linkInput = document.getElementById('inviteLinkText');
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(linkInput.value);
            alert('Invite link copied to clipboard! Share it with your friends.');
        }

        async function loadProfile() {
            if (!${JSON.stringify(!!currentUser)}) return;
            const res = await fetch('/api/profile');
            const user = await res.json();
            
            document.getElementById('displayBio').innerText = user.bio || 'No bio added yet.';
            document.getElementById('displayLocation').innerText = user.location || 'Location not set';
            
            document.getElementById('editBio').value = user.bio || '';
            document.getElementById('editLocation').value = user.location || '';
            document.getElementById('editAvatar').value = user.avatarUrl || '';

            if (user.avatarUrl) {
                document.getElementById('profileAvatarDisplay.innerHTML') || 
                (document.getElementById('profileAvatarDisplay').innerHTML = \`<img src="\${user.avatarUrl}" alt="Avatar">\`);
            }
        }

        async function updateProfile() {
            const bio = document.getElementById('editBio').value;
            const locationVal = document.getElementById('editLocation').value;
            const avatarUrl = document.getElementById('editAvatar').value;

            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ bio, location: locationVal, avatarUrl })
            });
            const data = await res.json();
            alert(data.message);
            loadProfile();
            showTab('profileTab');
        }

        async function addFriend(targetUsername) {
            const res = await fetch('/api/add-friend', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ recipient: targetUsername })
            });
            const data = await res.json();
            alert(data.message);
            loadMembers();
        }

        function loadMembers() {
            if (!${JSON.stringify(!!currentUser)}) return;
            fetch('/api/members')
                .then(res => res.json())
                .then(members => {
                    const container = document.getElementById('membersContainer');
                    if (members.length === 0) {
                        container.innerHTML = '<p style="font-size: 13px; color: #8e8e8e;">No other members on TexUs yet.</p>';
                        return;
                    }
                    container.innerHTML = members.map(m => \`
                        <div class="user-card">
                            <div class="user-info">
                                <div class="avatar">
                                    \${m.avatarUrl ? \`<img src="\${m.avatarUrl}" alt="Avatar">\` : m.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <strong style="font-size: 14px;">\${m.username}</strong>
                                </div>
                            </div>
                            \${m.isFriend 
                                ? '<span class="friend-badge"><i class="fas fa-check"></i> Friends</span>' 
                                : \`<button class="add-btn" onclick="addFriend('\${m.username}')">+ Add Friend</button>\`
                            }
                        </div>
                    \`).join('');
                });
        }

        loadProfile();
        loadMembers();
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('TexUs server running on port ' + PORT);
});