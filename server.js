const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 1. Mount Real-Time REST API routes at /api
app.use('/api', require('./routes/api'));

// 2. Dynamic JSON interceptors so existing frontend loadMockData() fetches live MongoDB records!
const User = require('./models/User');
const Department = require('./models/Department');
const Issue = require('./models/Issue');
const Report = require('./models/Report');
const CommunityReport = require('./models/CommunityReport');

app.get(['/data/users.json', '/Nivara/data/users.json'], async (req, res) => {
  res.json(await User.find());
});
app.get(['/data/departments.json', '/Nivara/data/departments.json'], async (req, res) => {
  res.json(await Department.find());
});
app.get(['/data/issues.json', '/Nivara/data/issues.json'], async (req, res) => {
  res.json(await Issue.find().sort({ createdAt: -1 }));
});
app.get(['/data/reports.json', '/Nivara/data/reports.json'], async (req, res) => {
  res.json(await Report.find().sort({ createdAt: -1 }));
});
app.get(['/data/community-reports.json', '/Nivara/data/community-reports.json'], async (req, res) => {
  res.json(await CommunityReport.find().sort({ createdAt: -1 }));
});

// 3. Serve the Nivara frontend static files when it is placed next to this
//    folder (the two are separate repositories, so the folder name varies).
const staticCandidates = [
  'Nivara',
  'nivara-frontend',
  'nivara',
  'frontend',
  'nivara-frontend-main',
].map((name) => path.join(__dirname, '..', name));

const nivaraStaticPath = staticCandidates.find(
  (dir) => fs.existsSync(path.join(dir, 'index.html'))
);

if (nivaraStaticPath) {
  app.use(express.static(nivaraStaticPath));
  console.log(`🖥️  [Nivara Static]  Serving the frontend from ${nivaraStaticPath}`);
} else {
  console.log('🖥️  [Nivara Static]  Frontend folder not found next to the backend — serving the API only.');
  console.log('                   Expected one of: ' + staticCandidates.join(', '));
}

const PORT = process.env.PORT || 5050;
const server = app.listen(PORT, () => {
  console.log(`🚀 [Nivara Server] Running on http://localhost:${PORT}`);
  console.log(`📡 [Nivara API]    Real-time MongoDB API ready at http://localhost:${PORT}/api`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error('   On macOS the AirPlay Receiver often holds port 5000 — turn it off in');
    console.error('   System Settings → General → AirDrop & Handoff, or pick another port:');
    console.error('   PORT=5050 npm start');
    console.error('   Then point the frontend at it by setting apiBaseUrl in js/config.js.');
    process.exit(1);
  }
  console.error('❌ Server error:', err.message);
  process.exit(1);
});
