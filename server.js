// In-Memory User Storage (replaces MongoDB for testing)
const users = [];

// Signup Route (Without MongoDB)
app.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user object
    const newUser = {
      _id: Date.now().toString(),
      name, 
      email, 
      phone, 
      password: hashedPassword,
      bio: '',
      followers: [],
      following: [],
      friendRequests: [],
      friends: []
    };
    
    users.push(newUser);

    // Log user in automatically using session
    req.session.userId = newUser._id;
    req.session.user = { id: newUser._id, name: newUser.name, email: newUser.email };

    res.status(201).json({ message: 'User registered and logged in successfully!' });
  } catch (err) {
    console.error('Signup error details:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// Login Route (Without MongoDB)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user._id;
    req.session.user = { id: user._id, name: user.name, email: user.email };

    res.status(200).json({ message: 'Logged in successfully!' });
  } catch (err) {
    console.error('Login error details:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Profile Route (Without MongoDB)
app.get('/profile', (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const user = users.find(u => u._id === req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { password, ...userProfile } = user;
    res.status(200).json(userProfile);
  } catch (err) {
    console.error('Profile error details:', err);
    res.status(500).json({ error: 'Server error fetching profile.' });
  }
});
