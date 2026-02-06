const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const CASAuthentication = require('cas-authentication');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'Niconoguez_JWT_Secret';

// CAS Configuration
const cas = new CASAuthentication({
  cas_url: 'https://login.cs.vt.edu/cas',
  service_url: process.env.SERVICE_URL || 'https://pr2niconoguez.discovery.cs.vt.edu',
  cas_version: '3.0',
  renew: false,
  is_dev_mode: false,
  dev_mode_user: '',
  session_name: 'cas_user',
  session_info: 'cas_userinfo',
  destroy_session: false
});

// Role Definitions - Map PIDs to roles
// In production, this would come from a database
const USER_ROLES = {
  'niconoguez': 'admin',
  'gracanin': 'admin',
  'kiymet': 'editor',
  'swanandsv': 'admin'
};

// Default role for authenticated users not in the map
const DEFAULT_ROLE = 'viewer';

// Role permissions - what each role can do
const ROLE_PERMISSIONS = {
  viewer: ['GET'],           // Can only read
  editor: ['GET', 'PUT'],  // Can read and modify
  admin: ['GET', 'POST', 'PUT', 'DELETE']  // Can do everything
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true // Allow cookies for CAS sessions
}));
app.use(morgan('combined'));
app.use(cookieParser());

app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
	secure: false,
	httpOnly: true,
	maxAge: 24 * 60 * 60 * 1000
  }
}));
//app.use(express.json());
//app.use(express.urlencoded({ extended: true }));

// Service endpoints
const SERVICES = {
  chatbot: process.env.CHATBOT_URL || 'http://chatbotservice:3000',
  update: process.env.UPDATE_URL || 'http://update-service:3000',
  create: process.env.CREATE_URL || 'http://create-service:3000',
  delete: process.env.DELETE_URL || 'http://delete-service:3000',
};

// Health check endpoint - no auth required
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  });
});

// CAS Login Endpoint - Initiates CAS authentication
app.get('/login', cas.bounce, (req, res) => {
  // After successful CAS authentication, generate JWT
  const pid = req.session[cas.session_name];
  const role = USER_ROLES[pid] || DEFAULT_ROLE;
  
  const token = jwt.sign(
    { 
      pid: pid,
      role: role,
      timestamp: new Date().toISOString()
    },
    JWT_SECRET,
    { expiresIn: '24h' } // Token valid for 24 hours
  );

  res.cookie('jwt_token', token, {
    httpOnly: true,
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  });

  console.log('User ${pid} logged in with role: ${role}');

  const redirectTo = req.session.returnTo;
  delete req.session.returnTo

  return res.redirect(redirectTo);
});

// CAS Logout Endpoint
app.get('/logout', (req, res) => {
  const pid = req.session ? req.session[cas.session_name] : 'unknown';
  console.log('User ${pid} logged out');

  // Destroy session and redirect to CAS logout
  req.session = null;
  res.redirect(cas.cas_url + '/logout');
});

// JWT Verification Middleware
function verifyToken(req, res, next) {
  // Check for token in Authorization header or cookie
  let token = null;

  // Try Authorization header first (Bearer token)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Try cookie as fallback
  if (!token && req.cookies.jwt_token) {
    token = req.cookies.jwt_token;
  }

  if (!token) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (err) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
   }
}

// RBAC Middleware - Check if user has permission for the HTTP method
function checkPermission(req, res, next) {
  const userRole = req.user.role;
  const method = req.method;
  const allowedMethods = ROLE_PERMISSIONS[userRole] || [];

  if (!allowedMethods.includes(method)) {
    console.log(`Access denied: User ${req.user.pid} (${userRole}) attempted ${method}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: `Your role (${userRole}) does not have permission to perform ${method} operations`,
      yourRole: userRole,
      yourPermissions: allowedMethods,
      requiredPermissions: [method]
    });
  }

  console.log(`Access granted: User ${req.user.pid} (${userRole}) performing ${method}`);
  next();
}

// Proxy configuration
const createProxyOptions = (target, keepPath = true) => ({
  target,
  changeOrigin: true,
  timeout: 60000,
  proxyTimeout: 60000,
  pathRewrite: keepPath ? undefined : (path, req) => {
    return path.replace(/^\/chatbot/, '');
  },
  onError: (err, req, res) => {
    console.error(`Proxy error for ${target}:`, err.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'The service is temporarily unavailable',
      service: target,
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('X-Gateway-Request', 'true');
    proxyReq.setHeader('X-User-PID', req.user.pid);
    proxyReq.setHeader('X-User-Role', req.user.role);
    console.log(`Proxying ${req.method} ${req.url} to ${target} (User: ${req.user.pid}, Role: ${req.user.role})`);
  },
});

// Apply authentication and RBAC to all API routes
app.use('/chatbot', verifyToken, checkPermission, createProxyMiddleware({
  ...createProxyOptions(SERVICES.chatbot, false),
}));

app.use('/create', verifyToken, checkPermission, createProxyMiddleware({
  ...createProxyOptions(SERVICES.create, true),
}));

app.use('/update', verifyToken, checkPermission, createProxyMiddleware({
  ...createProxyOptions(SERVICES.update, true),
}));

app.use('/delete', verifyToken, checkPermission, createProxyMiddleware({
  ...createProxyOptions(SERVICES.delete, true),
}));

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway with CAS + RBAC running on port ${PORT}`);
  console.log('CAS URL:', cas.cas_url);
  console.log('Service URL:', cas.service_url);
  console.log('Configured services:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  - ${name}: ${url}`);
  });
  console.log('\nRole Permissions:');
  Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
    console.log(`  - ${role}: ${perms.join(', ')}`);
  });
});
