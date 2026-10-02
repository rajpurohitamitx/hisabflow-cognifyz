require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const webRoutes = require('./routes/web');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.locals.fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

['/login', '/signin'].forEach((p) => app.get(p, (req, res) => res.redirect('/auth/login')));
['/register', '/signup'].forEach((p) => app.get(p, (req, res) => res.redirect('/auth/register')));
// old bookmark / cached redirect safety: /welcome simply goes to the dashboard
app.get('/welcome', (req, res) => res.redirect('/dashboard'));
// If a browser ever re-sends a form POST to one of these pages (307 redirect), send it to the page as a normal GET.
app.post(['/dashboard', '/welcome', '/'], (req, res) => res.redirect(303, '/dashboard'));
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/', webRoutes);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route not found' });
  res.status(404).render('error', { title: 'Page not found', message: `We couldn't find ${req.path}. Check the address or go back to your shop.` });
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || (err.name === 'CastError' ? 404 : 500);
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : (status === 404 ? 'Not found' : 'Bad request') });
  res.status(status).render('error', { title: status === 404 ? 'Page not found' : 'Something went wrong', message: 'Please try again. Check the server log for details.' });
});

let dbPromise = null;

async function connectDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /replace-with/i.test(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a real random value of 32+ characters.');
  }

  if (mongoose.connection.readyState === 1) return;
  if (!dbPromise) {
    dbPromise = mongoose.connect(process.env.MONGODB_URI).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  await dbPromise;
}

async function boot() {
  await connectDb();
  app.listen(PORT, () => console.log(`HisabFlow running at http://localhost:${PORT}`));
}

// Vercel invokes this exported function for every HTTP request.
// The database connection is cached between warm invocations.
async function vercelHandler(req, res) {
  try {
    await connectDb();
    return app(req, res);
  } catch (err) {
    console.error('[startup]', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'HisabFlow could not connect to its database.' });
    }
  }
}

if (require.main === module) boot().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});

module.exports = vercelHandler;
module.exports.app = app;
module.exports.boot = boot;
