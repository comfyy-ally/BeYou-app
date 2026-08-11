const express = require('express');
const Datastore = require('nedb-promises');

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Local Database Files (No compilation required!)
const postsDb = Datastore.create({ filename: './posts.db', autoload: true });
const chatDb = Datastore.create({ filename: './chat.db', autoload: true });

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BeYou</title>
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body { background-color: #fafafa; color: #262626; display: flex; justify-content: center; padding-bottom: 60px; }
        .main-wrapper { width: 100%; max-width: 480px; background: #fff; min-height: 100vh; border-left: 1px solid #dbdbdb; border-right: 1px solid #dbdbdb; position: relative; }
        
        /* Top Header */
        .top-header { position: sticky; top: 0; background: #fff; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #dbdbdb; z-index: 10; }
        .logo { font-size: 1.5rem; font-weight: 800; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header-icons i { font-size: 1.3rem; margin-left: 15px; cursor: pointer; color: #262626; }

        /* Navigation Bar */
        .bottom-nav { position: fixed; bottom: 0; width: 100%; max-width: 480px; background: #fff; display: flex; justify-content: space-around; padding: 12px 0; border-top: 1px solid #dbdbdb; z-index: 10; }
        .nav-item { font-size: 1.4rem; color: #8e8e8e; cursor: pointer; }
        .nav-item.active { color: #0095f6; }

        /* Stories Bar */
        .stories-container { display: flex; gap: 12px; padding: 12px 16px; overflow-x: auto; border-bottom: 1px solid #efefef; scrollbar-width: none; }
        .story { display: flex; flex-direction: column; align-items: center; font-size: 0.75rem; cursor: pointer; }
        .story-ring { width: 56px; height: 56px; border-radius: 50%; padding: 2px; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); margin-bottom: 4px; }
        .story-avatar { width: 100%; height: 100%; border-radius: 50%; border: 2px solid #fff; background: #eee; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #555; }

        /* Content Views */
        .tab-content { display: none; padding: 15px; }
        .tab-content.active { display: block; }

        /* Post Creation Card */
        .create-card { background: #fff; border: 1px solid #dbdbdb; border-radius: 12px; padding: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .create-card input, .create-card textarea { width: 100%; padding: 10px; border: 1px solid #efefef; border-radius: 8px; margin-bottom: 8px; outline: none; background: #fafafa; }
        .create-card button { background: #0095f6; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; }

        /* Post Feed Styling */
        .post-card { background: #fff; border: 1px solid #dbdbdb; border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
        .post-header { display: flex; align-items: center; padding: 10px 14px; gap: 10px; }
        .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: #0095f6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; }
        .post-username { font-weight: 600; font-size: 0.9rem; }
        .post-body { padding: 12px 14px; font-size: 0.95rem; line-height: 1.4; }
        .post-actions { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 1.2rem; }
        .action-left i { margin-right: 14px; cursor: pointer; }
        .post-likes { padding: 0 14px; font-weight: 600; font-size: 0.85rem; margin-bottom: 6px; }
        .comments-section { padding: 0 14px 12px 14px; font-size: 0.85rem; }
        .comment-item { margin-top: 4px; color: #444; }
        .comment-input-box { display: flex; gap: 6px; margin-top: 8px; }
        .comment-input-box input { flex: 1; padding: 6px; border: 1px solid #efefef; border-radius: 6px; }
        .comment-input-box button { background: none; border: none; color: #0095f6; font-weight: 600; cursor: pointer; }

        /* TikTok Reels Container */
        .tiktok-feed { height: 65vh; background: #111; border-radius: 16px; display: flex; flex-direction: column; justify-content: flex-end; padding: 20px; color: white; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .reel-actions { position: absolute; right: 15px; bottom: 60px; display: flex; flex-direction: column; gap: 20px; align-items: center; }
        .reel-actions i { font-size: 1.8rem; cursor: pointer; }

        /* Chat Styling */
        .chat-container { display: flex; flex-direction: column; height: 60vh; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 10px; border: 1px solid #efefef; border-radius: 8px; background: #fafafa; margin-bottom: 10px; }
        .chat-bubble { background: #eef1f5; padding: 8px 12px; border-radius: 12px; margin-bottom: 8px; max-width: 80%; font-size: 0.9rem; }
      </style>
    </head>
    <body>

      <div class="main-wrapper">
        <div class="top-header">
          <div class="logo">BeYou</div>
          <div class="header-icons">
            <i class="fa-regular fa-heart"></i>
            <i class="fa-regular fa-paper-plane" onclick="switchTab('chatTab')"></i>
          </div>
        </div>

        <div class="stories-container">
          <div class="story"><div class="story-ring"><div class="story-avatar">+</div></div><span>Your story</span></div>
          <div class="story"><div class="story-ring"><div class="story-avatar">A</div></div><span>Alex</span></div>
          <div class="story"><div class="story-ring"><div class="story-avatar">S</div></div><span>Sarah</span></div>
          <div class="story"><div class="story-ring"><div class="story-avatar">M</div></div><span>Mike</span></div>
        </div>

        <div id="feedTab" class="tab-content active">
          <div class="create-card">
            <input type="text" id="username" placeholder="Your Username...">
            <textarea id="content" rows="2" placeholder="What's on your mind?"></textarea>
            <button onclick="createPost()">Post</button>
          </div>
          <div id="feed"></div>
        </div>

        <div id="reelsTab" class="tab-content">
          <div class="tiktok-feed">
            <div class="reel-actions">
              <i class="fa-solid fa-heart" style="color: #ff3b5c;"></i>
              <i class="fa-solid fa-comment"></i>
              <i class="fa-solid fa-share"></i>
            </div>
            <h3>@beyou_official</h3>
            <p style="font-size: 0.9rem; opacity: 0.9;">Welcome to the BeYou Short Video Feed! 🎵 original sound</p>
          </div>
        </div>

        <div id="chatTab" class="tab-content">
          <h3 style="margin-bottom: 10px;">Direct Messages</h3>
          <div class="chat-container">
            <div class="chat-messages" id="chatWindow"></div>
            <input type="text" id="chatSender" placeholder="Your Name" style="padding: 8px; margin-bottom: 6px; border: 1px solid #ddd; border-radius: 6px;">
            <div style="display: flex; gap: 6px;">
              <input type="text" id="chatInput" placeholder="Write a message..." style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onkeydown="if(event.key==='Enter') sendMessage()">
              <button onclick="sendMessage()" style="background: #0095f6; color: white; border: none; padding: 8px 14px; border-radius: 6px;">Send</button>
            </div>
          </div>
        </div>

        <div class="bottom-nav">
          <div class="nav-item active" onclick="switchTab('feedTab', this)"><i class="fa-solid fa-house"></i></div>
          <div class="nav-item" onclick="switchTab('reelsTab', this)"><i class="fa-solid fa-film"></i></div>
          <div class="nav-item" onclick="switchTab('chatTab', this)"><i class="fa-regular fa-comment"></i></div>
        </div>
      </div>

      <script>
        function switchTab(tabId, el) {
          document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          document.getElementById(tabId).classList.add('active');
          if (el) el.classList.add('active');
        }

        async function fetchPosts() {
          const res = await fetch('/api/posts');
          const posts = await res.json();
          const feed = document.getElementById('feed');
          feed.innerHTML = '';

          posts.forEach(post => {
            const postEl = document.createElement('div');
            postEl.className = 'post-card';
            postEl.innerHTML = \`
              <div class="post-header">
                <div class="user-avatar">\${post.username.charAt(0).toUpperCase()}</div>
                <div class="post-username">\${post.username}</div>
              </div>
              <div class="post-body">\${post.content}</div>
              <div class="post-actions">
                <div class="action-left">
                  <i class="fa-regular fa-heart" onclick="likePost('\${post._id}')"></i>
                  <i class="fa-regular fa-comment"></i>
                </div>
                <i class="fa-regular fa-bookmark"></i>
              </div>
              <div class="post-likes">\${post.likes || 0} likes</div>
              <div class="comments-section">
                \${(post.comments || []).map(c => \`<div class="comment-item"><strong>User:</strong> \${c}</div>\`).join('')}
                <div class="comment-input-box">
                  <input type="text" id="comment-\${post._id}" placeholder="Add a comment...">
                  <button onclick="addComment('\${post._id}')">Post</button>
                </div>
              </div>
            \`;
            feed.appendChild(postEl);
          });
        }

        async function createPost() {
          const username = document.getElementById('username').value || 'Anonymous';
          const content = document.getElementById('content').value;
          if (!content) return alert('Post cannot be empty!');

          await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, content })
          });

          document.getElementById('content').value = '';
          fetchPosts();
        }

        async function likePost(id) {
          await fetch(\`/api/posts/\${id}/like\`, { method: 'POST' });
          fetchPosts();
        }

        async function addComment(id) {
          const input = document.getElementById(\`comment-\${id}\`);
          const text = input.value;
          if (!text) return;

          await fetch(\`/api/posts/\${id}/comment\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment: text })
          });

          input.value = '';
          fetchPosts();
        }

        async function fetchMessages() {
          const res = await fetch('/api/chat');
          const messages = await res.json();
          const chatWindow = document.getElementById('chatWindow');
          
          chatWindow.innerHTML = messages.map(m => 
            \`<div class="chat-bubble"><strong>\${m.sender}:</strong> \${m.text}</div>\`
          ).join('');

          chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        async function sendMessage() {
          const sender = document.getElementById('chatSender').value || 'Anonymous';
          const text = document.getElementById('chatInput').value;
          if (!text) return;

          await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender, text })
          });

          document.getElementById('chatInput').value = '';
          fetchMessages();
        }

        fetchPosts();
        fetchMessages();
        setInterval(fetchMessages, 2000);
      </script>
    </body>
    </html>
  `);
});

// API Routes
app.get('/api/posts', async (req, res) => {
  const posts = await postsDb.find({}).sort({ createdAt: -1 });
  res.json(posts);
});

app.post('/api/posts', async (req, res) => {
  const { username, content } = req.body;
  const newPost = await postsDb.insert({
    username,
    content,
    likes: 0,
    comments: [],
    createdAt: new Date()
  });
  res.status(201).json(newPost);
});

app.post('/api/posts/:id/like', async (req, res) => {
  await postsDb.update({ _id: req.params.id }, { $inc: { likes: 1 } });
  res.json({ message: 'Liked' });
});

app.post('/api/posts/:id/comment', async (req, res) => {
  const { comment } = req.body;
  await postsDb.update({ _id: req.params.id }, { $push: { comments: comment } });
  res.json({ message: 'Comment added' });
});

app.get('/api/chat', async (req, res) => {
  const messages = await chatDb.find({}).sort({ createdAt: 1 });
  res.json(messages);
});

app.post('/api/chat', async (req, res) => {
  const { sender, text } = req.body;
  const newMsg = await chatDb.insert({
    sender,
    text,
    createdAt: new Date()
  });
  res.status(201).json(newMsg);
});

app.listen(PORT, () => {
  console.log(`BeYou App running smoothly at http://localhost:${PORT}`);
});