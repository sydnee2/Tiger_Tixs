const request = require("supertest");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const mockUsersFile = path.join(__dirname, "test-users.json");

/**
 * Purpose: Creates an isolated test instance of the authentication server
 * Input: None
 * Output: Express app configured with all authentication routes for testing
 */
function createTestApp() {
  const app = express();
  const JWT_SECRET = "test_secret_key";
  const TOKEN_EXPIRY = "30m";

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  /**
   * Purpose: Loads user data from the test file system
   * Input: None
   * Output: Array of user objects or empty array if file doesn't exist
   */
  function loadUsers() {
    try {
      const raw = fs.readFileSync(mockUsersFile, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Purpose: Persists user data to the test file system
   * Input: users - Array of user objects to save
   * Output: Writes JSON to mockUsersFile
   */
  function saveUsers(users) {
    fs.writeFileSync(mockUsersFile, JSON.stringify(users, null, 2));
  }

  /**
   * Purpose: Middleware to verify JWT tokens and protect routes
   * Input: req - Request object with token in cookie or Authorization header
   *        res - Response object for sending 401 errors
   *        next - Next middleware function
   * Output: Attaches decoded user info to req.user or returns 401 error
   */
  function authenticateToken(req, res, next) {
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
   * Input: JSON body with email and password
   * Output: 201 with user email on success, 400/409 on validation errors
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
   * Input: JSON body with email and password
   * Output: 200 with JWT cookie on success, 400/401 on invalid credentials
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

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000,
    });

    return res.json({ message: 'Logged in', email: user.email });
  });

  /**
   * Purpose: Clears authentication token cookie to log user out
   * Input: None
   * Output: 200 with confirmation message and expired cookie
   */
  app.post('/logout', (req, res) => {
    res.cookie('token', '', { httpOnly: true, maxAge: 0 });
    return res.json({ message: 'Logged out' });
  });

  /**
   * Purpose: Checks current authentication status without requiring valid token
   * Input: Optional token in cookie
   * Output: JSON with authenticated boolean and email if valid
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
   * Input: Valid JWT token required via authenticateToken middleware
   * Output: JSON with user email and id, or 401 if not authenticated
   */
  app.get('/profile', authenticateToken, (req, res) => {
    return res.json({ email: req.user.email, id: req.user.id });
  });

  return app;
}

let app;

/**
 * Purpose: Set up test environment before all tests run
 * Input: None
 * Output: Creates test app instance and initializes empty test users file
 */
beforeAll(() => {
  app = createTestApp();
  // Clear test users file
  if (fs.existsSync(mockUsersFile)) {
    fs.unlinkSync(mockUsersFile);
  }
  fs.writeFileSync(mockUsersFile, '[]');
});

/**
 * Purpose: Clean up test environment after all tests complete
 * Input: None
 * Output: Removes test users file from file system
 */
afterAll(() => {
  // Cleanup
  if (fs.existsSync(mockUsersFile)) {
    fs.unlinkSync(mockUsersFile);
  }
});

/**
 * Purpose: Reset test data before each individual test
 * Input: None
 * Output: Clears all users from test file to ensure test isolation
 */
beforeEach(() => {
  // Reset users before each test
  fs.writeFileSync(mockUsersFile, '[]');
});

describe("User Registration", () => {
  /**
   * Purpose: Verifies successful user registration with bcrypt password hashing
   * Input: Valid email and password via POST /register
   * Output: 201 status
   */
  test("POST /register creates new user with hashed password", async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Registered');
    expect(res.body).toHaveProperty('email', 'test@example.com');

    // Verify password is hashed
    const users = JSON.parse(fs.readFileSync(mockUsersFile, 'utf8'));
    expect(users[0]).toHaveProperty('passwordHash');
    expect(users[0].passwordHash).not.toBe('password123');
    expect(users[0].passwordHash.startsWith('$2a$')).toBe(true);
  });

  /**
   * Purpose: Validates input validation for missing email field
   * Input: POST /register with only password (no email)
   * Output: 400 Bad Request
   */
  test("POST /register returns 400 when email missing", async () => {
    const res = await request(app)
      .post('/register')
      .send({ password: 'password123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('Email and password required');
  });

  /**
   * Purpose: Validates input validation for missing password field
   * Input: POST /register with only email (no password)
   * Output: 400 Bad Request
   */
  test("POST /register returns 400 when password missing", async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com' });

    expect(res.statusCode).toBe(400);
  });

  /**
   * Purpose: Ensures duplicate email addresses are rejected
   * Input: Two POST /register requests with same email
   * Output: First succeeds (201), second returns 409 Conflict
   */
  test("POST /register returns 409 for duplicate email", async () => {
    await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123' });

    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'different' });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain('User already exists');
  });
});

describe("User Login", () => {
  /**
   * Purpose: Set up a registered user before each login test
   * Input: None
   * Output: Creates user login@example.com for testing
   */
  beforeEach(async () => {
    await request(app)
      .post('/register')
      .send({ email: 'login@example.com', password: 'mypassword' });
  });

  /**
   * Purpose: Verifies successful login returns JWT in HttpOnly cookie
   * Input: Valid credentials via POST /login
   * Output: 200 status
   */
  test("POST /login returns JWT in HttpOnly cookie", async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'login@example.com', password: 'mypassword' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged in');
    expect(res.body).toHaveProperty('email', 'login@example.com');
    
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('token=');
    expect(cookies[0]).toContain('HttpOnly');
  });

  /**
   * Purpose: Validates rejection of non-existent email addresses
   * Input: POST /login with unregistered email
   * Output: 401 Unauthorized
   */
  test("POST /login returns 401 for invalid email", async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'wrong@example.com', password: 'mypassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Invalid credentials');
  });

  /**
   * Purpose: Validates rejection of incorrect passwords
   * Input: POST /login with valid email but wrong password
   * Output: 401 Unauthorized
   */
  test("POST /login returns 401 for invalid password", async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Invalid credentials');
  });

  /**
   * Purpose: Validates input validation when credentials are missing
   * Input: POST /login with empty body
   * Output: 400 Bad Request
   */
  test("POST /login returns 400 when credentials missing", async () => {
    const res = await request(app)
      .post('/login')
      .send({});

    expect(res.statusCode).toBe(400);
  });
});

describe("Token-Based Authentication", () => {
  let authCookie;

  /**
   * Purpose: Set up authenticated session before each test
   * Input: None
   * Output: Registers user and logs in, storing JWT cookie for tests
   */
  beforeEach(async () => {
    await request(app)
      .post('/register')
      .send({ email: 'auth@example.com', password: 'testpass' });

    const loginRes = await request(app)
      .post('/login')
      .send({ email: 'auth@example.com', password: 'testpass' });

    authCookie = loginRes.headers['set-cookie'];
  });

  /**
   * Purpose: Verifies /me endpoint returns authenticated status with valid token
   * Input: GET /me with valid JWT cookie
   * Output: 200 status
   */
  test("GET /me returns authenticated status with valid token", async () => {
    const res = await request(app)
      .get('/me')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('authenticated', true);
    expect(res.body).toHaveProperty('email', 'auth@example.com');
  });

  /**
   * Purpose: Verifies /me returns unauthenticated when no token provided
   * Input: GET /me with no cookie or header
   * Output: 200 status
   */
  test("GET /me returns false when no token provided", async () => {
    const res = await request(app).get('/me');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('authenticated', false);
  });

  /**
   * Purpose: Verifies protected /profile route returns user data with valid token
   * Input: GET /profile with valid JWT cookie
   * Output: 200 status
   */
  test("GET /profile returns user data with valid token", async () => {
    const res = await request(app)
      .get('/profile')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('email', 'auth@example.com');
    expect(res.body).toHaveProperty('id');
  });

  /**
   * Purpose: Verifies protected route rejects requests without token
   * Input: GET /profile with no authentication
   * Output: 401 Unauthorized
   */
  test("GET /profile returns 401 without token", async () => {
    const res = await request(app).get('/profile');

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('No token provided');
  });

  /**
   * Purpose: Verifies protected route accepts JWT via Authorization header
   * Input: GET /profile with Bearer token in Authorization header
   * Output: 200 status
   */
  test("GET /profile accepts Bearer token in Authorization header", async () => {
    const tokenMatch = authCookie[0].match(/token=([^;]+)/);
    const token = tokenMatch[1];

    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('email', 'auth@example.com');
  });

  /**
   * Purpose: Verifies protected route rejects malformed or invalid tokens
   * Input: GET /profile with invalid token string
   * Output: 401 Unauthorized
   */
  test("GET /profile returns 401 with invalid token", async () => {
    const res = await request(app)
      .get('/profile')
      .set('Cookie', 'token=invalid_token_here');

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Invalid or expired token');
  });
});

describe("Logout & Session Handling", () => {
  let authCookie;

  /**
   * Purpose: Set up authenticated session before each logout test
   * Input: None
   * Output: Registers user and logs in, storing JWT cookie for tests
   */
  beforeEach(async () => {
    await request(app)
      .post('/register')
      .send({ email: 'logout@example.com', password: 'testpass' });

    const loginRes = await request(app)
      .post('/login')
      .send({ email: 'logout@example.com', password: 'testpass' });

    authCookie = loginRes.headers['set-cookie'];
  });

  /**
   * Purpose: Verifies logout clears the authentication cookie
   * Input: POST /logout with valid session
   * Output: 200 status
   */
  test("POST /logout clears the token cookie", async () => {
    const res = await request(app)
      .post('/logout')
      .set('Cookie', authCookie);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged out');

    const cookies = res.headers['set-cookie'];
    expect(cookies[0]).toContain('token=;');
    expect(cookies[0]).toContain('Max-Age=0');
  });

  /**
   * Purpose: Verifies /me returns unauthenticated after logout
   * Input: POST /logout followed by GET /me with cleared cookie
   * Output: authenticated:false in response
   */
  test("After logout, /me returns authenticated false", async () => {
    const logoutRes = await request(app)
      .post('/logout')
      .set('Cookie', authCookie);

    const clearedCookie = logoutRes.headers['set-cookie'];

    const res = await request(app)
      .get('/me')
      .set('Cookie', clearedCookie);

    expect(res.body).toHaveProperty('authenticated', false);
  });

  /**
   * Purpose: Verifies protected routes are inaccessible after logout
   * Input: POST /logout followed by GET /profile with cleared cookie
   * Output: 401 Unauthorized
   */
  test("After logout, /profile returns 401", async () => {
    const logoutRes = await request(app)
      .post('/logout')
      .set('Cookie', authCookie);

    const clearedCookie = logoutRes.headers['set-cookie'];

    const res = await request(app)
      .get('/profile')
      .set('Cookie', clearedCookie);

    expect(res.statusCode).toBe(401);
  });
});

describe("Password Security", () => {
  /**
   * Purpose: Verifies passwords are hashed using bcrypt algorithm
   * Input: User registration with plaintext password
   * Output: Stored password begins with $2a$ or $2b$
   *         and can be verified with bcrypt.compare
   */
  test("Passwords are hashed with bcrypt", async () => {
    await request(app)
      .post('/register')
      .send({ email: 'secure@example.com', password: 'plaintext123' });

    const users = JSON.parse(fs.readFileSync(mockUsersFile, 'utf8'));
    const user = users.find(u => u.email === 'secure@example.com');

    expect(user.passwordHash).toMatch(/^\$2[ab]\$\d{2}\$/);
    expect(user.passwordHash).not.toBe('plaintext123');
    
    const isValid = await bcrypt.compare('plaintext123', user.passwordHash);
    expect(isValid).toBe(true);
  });

  /**
   * Purpose: Ensures plaintext passwords never appear in storage
   * Input: User registration with password "secret123"
   * Output: users.json file does not contain "secret123" string
   *         and only contains "passwordHash" field
   */
  test("No plaintext passwords stored", async () => {
    await request(app)
      .post('/register')
      .send({ email: 'nopass@example.com', password: 'secret123' });

    const users = JSON.parse(fs.readFileSync(mockUsersFile, 'utf8'));
    const fileContent = JSON.stringify(users);

    expect(fileContent).not.toContain('secret123');
    expect(fileContent).toContain('passwordHash');
  });
});
