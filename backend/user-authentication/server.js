const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_with_a_strong_secret';
const TOKEN_EXPIRY = '30m';

const usersFile = path.join(__dirname, 'users.json');

app.use(express.json());
app.use(cookieParser());

/**
 * Purpose: Configure CORS to allow frontend authentication requests with credentials
 * Input: CORS configuration object with origin and credentials settings
 * Output: CORS middleware accepting requests from localhost:3000
 */
// Allow multiple origins via comma-separated ALLOWED_ORIGIN env var
const RAW_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN || 'http://localhost:3000,https://clemson-ticketing-system.vercel.app,http://150.136.222.183:3000/';
const allowedOrigins = RAW_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost:3000')) return callback(null, true);
    if (origin.startsWith('https://clemson-ticketing-system.vercel.app')) return callback(null, true);
    if (origin.startsWith('http://150.136.222.183:3000/')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.log('[user-auth] Blocked CORS origin', origin, 'Allowed:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Purpose: Loads user data from file-based storage
 * Input: None 
 * Output: Array of user objects or empty array if file doesn't exist
 */
function loadUsers() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Purpose: Persists user data to file-based storage
 * Input: users - Array of user objects to save
 * Output: Writes formatted JSON to usersFile
 */
function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

/**
 * Purpose: Middleware to verify JWT tokens and protect routes
 * Input: req - Request with token in cookie or Authorization header
 *        res - Response object for error messages
 *        next - Next middleware function
 * Output: Attaches user data to req.user or returns 401 error
 */
// JWT middleware
function authenticateToken(req, res, next) {
  // Look for token in cookie or Authorization header
  const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ message: 'Invalid or expired token' });
    req.user = { email: payload.email, id: payload.id };
    next();
  });
}

/**
 * Purpose: Handles new user registration with password hashing
 * Input: POST /register with JSON body containing email and password
 * Output: 201 with user email on success, 400/409 on validation/duplicate errors
 */
app.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const users = loadUsers();
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ message: 'User already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const newUser = { id: Date.now().toString(), email, passwordHash: hashed };
  users.push(newUser);
  saveUsers(users);

  return res.status(201).json({ message: 'Registered', email: newUser.email });
});

/**
 * Purpose: Authenticates user credentials and issues JWT in HttpOnly cookie
 * Input: POST /login with JSON body containing email and password
 * Output: 200 with JWT cookie and user email on success, 400/401 on errors
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  /**
   * Purpose: Set JWT token in HttpOnly cookie for secure storage
   * Input: Generated JWT token
   * Output: Cookie with 30-minute expiration, HttpOnly and SameSite attributes
   */
  // Consider production if explicitly set or if origin is not localhost (cross-site)
  const isProdCookie = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production' || (req.headers.origin && !req.headers.origin.startsWith('http://localhost'));
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProdCookie, // required for SameSite=None
    sameSite: isProdCookie ? 'none' : 'lax', // allow cross-site cookie when deployed
    maxAge: 30 * 60 * 1000,
  });

  // Also return token in body so frontend can use Authorization header for other services
  return res.json({ message: 'Logged in', email: user.email, token });
});

/**
 * Purpose: Clears authentication token cookie to log user out
 * Input: POST /logout request
 * Output: 200 with confirmation message and expired cookie
 */
app.post('/logout', (req, res) => {
  const isProdCookie = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production' || (req.headers.origin && !req.headers.origin.startsWith('http://localhost'));
  res.cookie('token', '', { httpOnly: true, maxAge: 0, secure: isProdCookie, sameSite: isProdCookie ? 'none' : 'lax' });
  return res.json({ message: 'Logged out' });
});

// Health endpoint for uptime / diagnostics
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Purpose: Checks current authentication status without requiring valid token
 * Input: GET /me with optional token in cookie
 * Output: JSON with authenticated boolean and email if token valid
 */
app.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ authenticated: false });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ authenticated: false, message: 'Expired or invalid token' });
    return res.json({ authenticated: true, email: payload.email });
  });
});

/**
 * Purpose: Protected route that returns user profile data
 * Input: GET /profile with valid JWT token
 * Output: JSON with user email and id, or 401 if not authenticated
 */
app.get('/profile', authenticateToken, (req, res) => {
  return res.json({ email: req.user.email, id: req.user.id });
});

/**
 * Purpose: Starts the Express server for user authentication
 * Input: PORT from environment variable or default 4000
 * Output: Running HTTP server and console confirmation message
 */
app.listen(PORT, '0.0.0.0', () => console.log(`User-auth service listening on ${PORT}`));
