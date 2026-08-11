const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session Setup: Keeps users logged in for 1 week
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

// --- PERMANENT CLOUD DATABASE CONNECTION (MONGODB ATLAS) ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://lenkoekarabo16_db_user:s9VX@Zn7z9o6c9fP@cluster0.youbf6r.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to permanent cloud database (MongoDB Atlas)!'))
  .catch(err => console.error('Database connection error:', err));

// --- MONGODB SCHEMAS & MODELS ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  bio: { type: String, default: 'Hey there! I am using TexUs.' },
  location: { type: String, default: 'Not specified' },
  avatarUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const friendSchema = new mongoose.Schema({
  requester: String,
  recipient: String,
  status: { type: String, default: 'accepted' },
  createdAt: { type: Date, default: Date.now }
});
const Friend = mongoose.model('Friend', friendSchema);

const chatSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);


// --- AUTHENTICATION API ROUTES ---

app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'This account already exists! Please log in instead.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ 
      username, 
      password: hashedPassword 
    });

    res.json({ success: true, message: 'Account created successfully! You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
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

// --- PROFILE ROUTES ---

app.get('/api/profile', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const user = await User.findOne({ username: req.session.user.username }, { password: 0 });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching profile.' });
  }
});

app.post('/api/profile/update', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const { bio, location, avatarUrl } = req.body;

  try {
    const updateData = { bio, location };
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl;
    }

    await User.updateOne(
      { username: req.session.user.username },
      { $set: updateData }
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
    const allUsers = await User.find({ username: { $ne: currentUser } }, { password: 0 });
    const userFriends = await Friend.find({
      $or: [
        { requester: currentUser },
        { recipient: currentUser }
      ]
    });

    const membersWithStatus = allUsers.map(u => {
      const isFriend = userFriends.some(
        f => (f.requester === u.username || f.recipient === u.username) && f.status === 'accepted'
      );
      return { ...u.toObject(), isFriend };
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
    const existing = await Friend.findOne({
      $or: [
        { requester, recipient },
        { requester: recipient, recipient: requester }
      ]
    });

    if (existing) {
      return res.json({ success: true, message: 'Friend request already sent or connected!' });
    }

    await Friend.create({ requester, recipient, status: 'accepted' });
    res.json({ success: true, message: `You are now friends with ${recipient}!` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add friend.' });
  }
});

// --- MESSAGING ROUTES ---

app.get('/api/friends-chats', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const currentUser = req.session.user.username;

  try {
    const userFriends = await Friend.find({
      $or: [
        { requester: currentUser },
        { recipient: currentUser }
      ],
      status: 'accepted'
    });

    const friendUsernames = userFriends.map(f => f.requester === currentUser ? f.recipient : f.requester);
    const friendsProfiles = await User.find({ username: { $in: friendUsernames } }, { password: 0 });

    res.json(friendsProfiles);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching chat friends.' });
  }
});

app.get('/api/messages/:friendUsername', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const currentUser = req.session.user.username;
  const { friendUsername } = req.params;

  try {
    const messages = await Chat.find({
      $or: [
        { sender: currentUser, receiver: friendUsername },
        { sender: friendUsername, receiver: currentUser }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Error loading messages.' });
  }
});

app.post('/api/messages/send', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const sender = req.session.user.username;
  const { receiver, text } = req.body;

  if (!text || !text.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });

  try {
    const newMsg = await Chat.create({
      sender,
      receiver,
      text: text.trim()
    });
    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message.' });
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
        .profile-card { text-align: center; padding: 25px 20px; background: #fafafa; }
        .profile-avatar-container { width: 90px; height: 90px; border-radius: 50%; background: #e1306c; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: bold; margin: 0 auto 12px; overflow: hidden; border: 2px solid #dbdbdb; cursor: pointer; }
        .profile-avatar-container img { width: 100%; height: 100%; object-fit: cover; }
        .profile-username { font-size: 20px; font-weight: bold; }
        .profile-location { font-size: 12px; color: #8e8e8e; margin-top: 3px; }
        
        .profile-actions { display: flex; gap: 10px; justify-content: center; margin: 15px 0; }
        .action-btn { padding: 8px 14px; background: #0095f6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; }
        .action-btn-secondary { background: #efefef; color: #262626; border: 1px solid #dbdbdb; }

        .profile-edit-box { background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #dbdbdb; margin-top: 15px; text-align: left; }
        .profile-edit-box label { font-size: 11px; font-weight: bold; color: #8e8e8e; display: block; margin-top: 8px; }
        .profile-edit-box textarea, .profile-edit-box input { width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #dbdbdb; border-radius: 4px; font-size: 13px; }
        .save-profile-btn { width: 100%; margin-top: 10px; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .logout-btn { width: 100%; margin-top: 12px; padding: 8px; background: #ed4956; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }

        /* Fullscreen Image Viewer Modal */
        #imgModal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100; justify-content: center; align-items: center; }
        #imgModal img { max-width: 90%; max-height: 90%; border-radius: 8px; }
        #imgModal span { position: absolute; top: 20px; right: 25px; color: #fff; font-size: 30px; cursor: pointer; }

        /* Messages & Chats View */
        .messages-container { padding: 15px; }
        .invite-box { background: #f0f8ff; border: 1px solid #b0e0e6; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left; }
        .invite-box h4 { color: #0077cc; margin-bottom: 6px; font-size: 14px; }
        .invite-box p { font-size: 12px; color: #555; margin-bottom: 8px; }
        .invite-link-input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px; background: #fff; margin-bottom: 8px; }
        .invite-btn { width: 100%; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px; }

        .chat-list-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; cursor: pointer; }
        .chat-user-info { display: flex; align-items: center; gap: 10px; }
        
        /* Active Chat Box */
        #activeChatView { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #fff; z-index: 20; display: flex; flex-direction: column; }
        .chat-header { display: flex; align-items: center; gap: 12px; padding: 15px; border-bottom: 1px solid #dbdbdb; background: #fff; font-weight: bold; }
        .chat-messages { flex: 1; padding: 15px; overflow-y: auto; background: #fafafa; display: flex; flex-direction: column; gap: 8px; }
        .msg-bubble { max-width: 75%; padding: 10px 14px; border-radius: 16px; font-size: 13px; word-break: break-word; }
        .msg-sent { background: #0095f6; color: #fff; align-self: flex-end; border-bottom-right-radius: 2px; }
        .msg-received { background: #efefef; color: #262626; align-self: flex-start; border-bottom-left-radius: 2px; }
        .chat-input-area { display: flex; padding: 12px; border-top: 1px solid #dbdbdb; background: #fff; gap: 8px; }
        .chat-input-area input { flex: 1; padding: 10px; border: 1px solid #dbdbdb; border-radius: 20px; outline: none; font-size: 13px; }
        .chat-input-area button { background: #0095f6; color: #fff; border: none; padding: 0 16px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 13px; }

        /* Members Directory */
        .user-list { padding: 15px; }
        .user-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed #eee; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; background: #3897f0; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; overflow: hidden; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .add-btn { background: #0095f6; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: bold; }
        .friend-badge { background: #eef7ee; color: #2e7d32; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }

        /* Bottom Navigation */
        nav { position: fixed; bottom: 0; width: 100%; max-width: 450px; background: #fff; border-top: 1px solid #dbdbdb; display: flex; justify-content: space-around; padding: 12px 0; font-size: 20px; z-index: 10; }
        nav i { cursor: pointer; color: #262626; }
    </style>
</head>
<body>
    <div class="main-wrapper">

    ${!currentUser ? `
        <div class="auth-screen" id="loginView">
            <h1>TexUs</h1>
            <p>Log in with your existing account</p>
            <input type="text" id="login-u" placeholder="Username" autocomplete="username">
            <input type="password" id="login-p" placeholder="Password" autocomplete="current-password">
            <button onclick="login()">Log In</button>
            <button class="toggle-btn" onclick="toggleAuth('signup')">New here? Create an account</button>
        </div>

        <div class="auth-screen" id="signupView" style="display: none;">
            <h1>TexUs</h1>
            <p>Create your account once to join TexUs.</p>
            <input type="text" id="signup-u" placeholder="Choose a Username" autocomplete="username">
            <input type="password" id="signup-p" placeholder="Choose a Password" autocomplete="new-password">
            <button onclick="signup()" style="background-color: #3897f0;">Sign Up</button>
            <button class="toggle-btn" onclick="toggleAuth('login')">Already have an account? Log In</button>
        </div>
    ` : `
        <header>
            <div class="logo">TexUs</div>
            <i class="far fa-user" onclick="showTab('profileTab')" style="cursor: pointer; font-size: 18px;" title="Profile"></i>
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
                    <p>Share this link with your friends:</p>
                    <input type="text" class="invite-link-input" id="inviteLinkText" value="https://beyou-app.onrender.com" readonly>
                    <button class="invite-btn" onclick="copyInviteLink()"><i class="fas fa-copy"></i> Copy Link</button>
                </div>

                <h3 style="font-size: 15px; margin-bottom: 10px;">Chats with Friends</h3>
                <div id="friendsChatsContainer">Loading chats...</div>
            </div>
        </div>

        <div id="activeChatView" class="hidden">
            <div class="chat-header">
                <i class="fas fa-arrow-left" onclick="closeActiveChat()" style="cursor: pointer;"></i>
                <div class="avatar" id="activeChatAvatar" style="width: 32px; height: 32px; font-size: 14px;"></div>
                <span id="activeChatUsername"></span>
            </div>
            <div class="chat-messages" id="chatMessagesContainer"></div>
            <div class="chat-input-area">
                <input type="text" id="chatMessageInput" placeholder="Type a message..." onkeypress="handleChatKeyPress(event)">
                <button onclick="sendChatMessage()">Send</button>
            </div>
        </div>

        <div id="profileTab" class="view-section hidden">
            <div class="profile-card">
                <div class="profile-avatar-container" id="profileAvatarDisplay" onclick="viewProfilePicture()" title="Click to View Profile Picture">
                    ${currentUser.charAt(0).toUpperCase()}
                </div>
                <div class="profile-username">@${currentUser}</div>
                <div class="profile-location" id="displayLocation">Location not set</div>
                
                <div class="profile-actions">
                    <button class="action-btn" onclick="triggerPhotoUpload()">Profile Picture</button>
                    <button class="action-btn action-btn-secondary" onclick="viewProfilePicture()">View Profile Picture</button>
                    <input type="file" id="photoUploadInput" accept="image/*" style="display: none;" onchange="handlePhotoUpload(event)">
                </div>

                <div class="profile-edit-box">
                    <label>ABOUT ME / BIO</label>
                    <textarea id="editBio" rows="2" placeholder="Tell us about yourself..."></textarea>
                    
                    <label>LOCATION</label>
                    <input type="text" id="editLocation" placeholder="e.g. New York, USA">

                    <button class="save-profile-btn" onclick="updateProfile()">Save Profile Details</button>
                </div>

                <button class="logout-btn" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Log Out of TexUs</button>
            </div>
        </div>

        <div id="imgModal" onclick="closeModal()">
            <span onclick="closeModal()">&times;</span>
            <img id="modalImgSrc" src="" alt="Profile Full View">
        </div>

        <nav>
            <i class="fas fa-users" onclick="showTab('membersTab'); loadMembers();" title="Members"></i>
            <i class="far fa-paper-plane" onclick="showTab('messagesTab'); loadFriendsChats();" title="Messages"></i>
            <i class="far fa-user" onclick="showTab('profileTab')" title="Profile"></i>
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
            if (data.success) {
                toggleAuth('login');
                document.getElementById('login-u').value = u;
            }
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
            document.getElementById(tabId).classList.remove('hidden');
        }

        function copyInviteLink() {
            const linkInput = document.getElementById('inviteLinkText');
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(linkInput.value);
            alert('Invite link copied to clipboard!');
        }

        let currentUserAvatarUrl = '';

        async function loadProfile() {
            if (!${JSON.stringify(!!currentUser)}) return;
            const res = await fetch('/api/profile');
            const user = await res.json();
            
            document.getElementById('displayLocation').innerText = user.location || 'Location not set';
            document.getElementById('editBio').value = user.bio || '';
            document.getElementById('editLocation').value = user.location || '';

            currentUserAvatarUrl = user.avatarUrl || '';
            if (currentUserAvatarUrl) {
                document.getElementById('profileAvatarDisplay').innerHTML = \`<img src="\${currentUserAvatarUrl}" alt="Avatar">\`;
            }
        }

        function triggerPhotoUpload() {
            document.getElementById('photoUploadInput').click();
        }

        function handlePhotoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(e) {
                const base64Image = e.target.result;
                currentUserAvatarUrl = base64Image;

                const bio = document.getElementById('editBio').value;
                const locationVal = document.getElementById('editLocation').value;

                await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ bio, location: locationVal, avatarUrl: base64Image })
                });
                alert('Profile picture updated successfully!');
                loadProfile();
            };
            reader.readAsDataURL(file);
        }

        function viewProfilePicture() {
            if (!currentUserAvatarUrl) {
                alert('No profile picture uploaded yet!');
                return;
            }
            document.getElementById('modalImgSrc').src = currentUserAvatarUrl;
            document.getElementById('imgModal').style.display = 'flex';
        }

        function closeModal() {
            document.getElementById('imgModal').style.display = 'none';
        }

        async function updateProfile() {
            const bio = document.getElementById('editBio').value;
            const locationVal = document.getElementById('editLocation').value;

            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ bio, location: locationVal })
            });
            const data = await res.json();
            alert(data.message);
            loadProfile();
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
            loadFriendsChats();
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

        let activeChatFriend = null;

        function loadFriendsChats() {
            if (!${JSON.stringify(!!currentUser)}) return;
            fetch('/api/friends-chats')
                .then(res => res.json())
                .then(friends => {
                    const container = document.getElementById('friendsChatsContainer');
                    if (friends.length === 0) {
                        container.innerHTML = '<p style="font-size: 13px; color: #8e8e8e;">No friends yet. Go to the Members tab to add friends and start chatting!</p>';
                        return;
                    }
                    container.innerHTML = friends.map(f => \`
                        <div class="chat-list-item" onclick="openActiveChat('\${f.username}', '\${f.avatarUrl || ''}')">
                            <div class="chat-user-info">
                                <div class="avatar" style="width: 40px; height: 40px; font-size: 16px;">
                                    \${f.avatarUrl ? \`<img src="\${f.avatarUrl}" alt="Avatar">\` : f.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <strong style="font-size: 14px;">\${f.username}</strong>
                                    <p style="font-size: 11px; color: #8e8e8e;">Tap to open chat</p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right" style="color: #c7c7c7; font-size: 12px;"></i>
                        </div>
                    \`).join('');
                });
        }

        function openActiveChat(username, avatarUrl) {
            activeChatFriend = username;
            document.getElementById('activeChatUsername').innerText = username;
            const avatarContainer = document.getElementById('activeChatAvatar');
            if (avatarUrl) {
                avatarContainer.innerHTML = \`<img src="\${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">\`;
            } else {
                avatarContainer.innerText = username.charAt(0).toUpperCase();
            }

            document.getElementById('activeChatView').classList.remove('hidden');
            fetchMessages();
        }

        function closeActiveChat() {
            document.getElementById('activeChatView').classList.add('hidden');
            activeChatFriend = null;
        }

        async function fetchMessages() {
            if (!activeChatFriend) return;
            const res = await fetch(\`/api/messages/\${activeChatFriend}\`);
            const messages = await res.json();

            const container = document.getElementById('chatMessagesContainer');
            container.innerHTML = messages.map(m => \`
                <div class="msg-bubble \${m.sender === '${currentUser}' ? 'msg-sent' : 'msg-received'}">
                    \${m.text}
                </div>
            \`).join('');
            container.scrollTop = container.scrollHeight;
        }

        async function sendChatMessage() {
            const input = document.getElementById('chatMessageInput');
            const text = input.value;
            if (!text.trim() || !activeChatFriend) return;

            const res = await fetch('/api/messages/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ receiver: activeChatFriend, text })
            });
            const data = await res.json();
            if (data.success) {
                input.value = '';
                fetchMessages();
            }
        }

        function handleChatKeyPress(event) {
            if (event.key === 'Enter') {
                sendChatMessage();
            }
        }

        loadProfile();
        loadMembers();
        loadFriendsChats();
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('TexUs server running on port ' + PORT);
});
