const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
const errorHandler = require('./middleware/error.middleware');

// Import route modules
const authRoutes = require('./modules/auth/auth.routes');
const groupsRoutes = require('./modules/groups/groups.routes');
const membershipsRoutes = require('./modules/memberships/memberships.routes');
const expensesRoutes = require('./modules/expenses/expenses.routes');
const balancesRoutes = require('./modules/balances/balances.routes');
const settlementsRoutes = require('./modules/settlements/settlements.routes');
const importsRoutes = require('./modules/imports/imports.routes');
const currencyRoutes = require('./modules/currency/currency.routes');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

// CORS
const allowedOrigins = [
  env.CLIENT_URL,
  env.CLIENT_URL.replace(/\/$/, ''),
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(null, false); // fallback
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.resolve(__dirname, '../', env.UPLOAD_DIR);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Group routes
app.use('/api/groups', groupsRoutes);

// Membership routes (nested under /api/groups)
app.use('/api/groups', membershipsRoutes);

// Settlement routes (nested under /api/groups)
app.use('/api/groups', settlementsRoutes);

// Expense routes (has both /api/groups/:id/expenses and /api/expenses/:id)
app.use('/api', expensesRoutes);

// Balance routes (has both /api/groups/:id/balances and /api/balances/me)
app.use('/api', balancesRoutes);

// Import routes (has both /api/groups/:id/imports and /api/imports/:id)
app.use('/api', importsRoutes);

// Currency routes
app.use('/api/currency', currencyRoutes);

// ─── 404 HANDLER ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── ERROR HANDLER (must be last) ────────────────────────────────────────────

app.use(errorHandler);

module.exports = app;
