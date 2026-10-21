const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const Issue = require('../models/Issue');
const Report = require('../models/Report');
const CommunityReport = require('../models/CommunityReport');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', database: 'MongoDB Connected', timestamp: new Date() });
});

// ==========================================
// 1. USERS & AUTHENTICATION
// ==========================================
router.get('/users', async (req, res) => {
  try {
    const users = await User.find(req.query);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, role } = req.body;
    const query = {};
    if (email) query.email = email.toLowerCase();
    if (role) query.role = new RegExp(role, 'i');
    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const user = await User.create({
      id: req.body.id || `user-${Date.now().toString().slice(-5)}`,
      ...req.body
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. DEPARTMENTS
// ==========================================
router.get('/departments', async (req, res) => {
  try {
    const departments = await Department.find(req.query);
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const dept = await Department.create(req.body);
    res.status(201).json(dept);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 3. ISSUES (Authority Operational Screen & Map)
// ==========================================
router.get('/issues', async (req, res) => {
  try {
    const issues = await Issue.find(req.query).sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/issues', async (req, res) => {
  try {
    const newId = req.body.id || `NVR-${String(Date.now()).slice(-5)}`;
    const issuePayload = {
      id: newId,
      status: 'Reported',
      reportedAt: new Date().toISOString(),
      ward: req.body.ward || 'Ward 153',
      department: req.body.department || 'Roads & Civil Works',
      slaHours: req.body.slaHours ?? 24,
      severity: req.body.severity || (req.body.priority === 'Critical' ? 9.2 : req.body.priority === 'High' ? 7.6 : 5.1),
      confidence: req.body.confidence || 92,
      latitude: Number(req.body.latitude) || 12.9258,
      longitude: Number(req.body.longitude) || 77.5838,
      ...req.body
    };
    const issue = await Issue.create(issuePayload);
    // Keep Report collection synced in real time
    await Report.findOneAndUpdate(
      { id: newId },
      { $setOnInsert: { ...issuePayload, updates: ['Report received'] } },
      { upsert: true }
    );
    res.status(201).json(issue);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/issues/:id', async (req, res) => {
  try {
    const updatedIssue = await Issue.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    await Report.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!updatedIssue) return res.status(404).json({ message: 'Issue not found' });
    res.json(updatedIssue);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 4. REPORTS (Citizen Portal & Real-Time Sync)
// ==========================================
router.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find(req.query).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports/:id', async (req, res) => {
  try {
    const report = await Report.findOne({ id: req.params.id });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reports', async (req, res) => {
  try {
    const deptMap = {
      Pothole: 'Roads & Civil Works',
      'Road Damage': 'Roads & Civil Works',
      Sidewalk: 'Roads & Civil Works',
      Garbage: 'Sanitation',
      Streetlight: 'Electrical Quick Response',
      Drainage: 'Water & Drainage',
      Water: 'Water & Drainage'
    };
    const slaMap = { Critical: 4, High: 12, Medium: 24, Low: 36 };
    const newId = req.body.id || `NVR-${String(Date.now()).slice(-5)}`;
    const priority = req.body.priority || 'Medium';

    const reportPayload = {
      id: newId,
      status: 'Reported',
      priority,
      reportedAt: new Date().toLocaleString(),
      updates: ['Report received'],
      department: req.body.department || deptMap[req.body.category] || 'Roads & Civil Works',
      ward: req.body.ward || 'Ward 153',
      slaHours: req.body.slaHours ?? (slaMap[priority] || 24),
      latitude: Number(req.body.latitude) || 12.9258,
      longitude: Number(req.body.longitude) || 77.5838,
      ...req.body
    };

    const createdReport = await Report.create(reportPayload);

    // Also automatically insert into Issues collection so Authority Queue & Live Map see it in real time
    await Issue.findOneAndUpdate(
      { id: newId },
      {
        $setOnInsert: {
          ...reportPayload,
          reportedAt: new Date().toISOString(),
          severity: req.body.severity || (priority === 'Critical' ? 9.2 : priority === 'High' ? 7.8 : 5.5),
          confidence: req.body.confidence || 93
        }
      },
      { upsert: true }
    );

    res.status(201).json(createdReport);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const updatedReport = await Report.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    await Issue.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!updatedReport) return res.status(404).json({ message: 'Report not found' });
    res.json(updatedReport);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    await Report.findOneAndDelete({ id: req.params.id });
    await Issue.findOneAndDelete({ id: req.params.id });
    res.json({ success: true, message: 'Report deleted from MongoDB' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. COMMUNITY REPORTS
// ==========================================
router.get('/community-reports', async (req, res) => {
  try {
    const items = await CommunityReport.find(req.query).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/community-reports', async (req, res) => {
  try {
    const item = await CommunityReport.create({
      id: req.body.id || `comm-${Date.now().toString().slice(-5)}`,
      ...req.body
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/community-reports/:id/verify', async (req, res) => {
  try {
    const updated = await CommunityReport.findOneAndUpdate(
      { id: req.params.id },
      { $inc: { confirmations: 1, upvotes: 1 } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Community report not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
