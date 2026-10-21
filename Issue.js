const mongoose = require('mongoose');
const { schemaOptions } = require('./options');

const issueSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, default: 'Pothole' },
  status: { type: String, default: 'Reported' },
  priority: { type: String, default: 'Medium' },
  severity: { type: Number, default: 5.0 },
  confidence: { type: Number, default: 90 },
  ward: { type: String, default: 'Ward 153' },
  location: { type: mongoose.Schema.Types.Mixed, default: 'Bengaluru' },
  department: { type: String, default: 'Roads & Civil Works' },
  reportedAt: { type: String, default: () => new Date().toISOString() },
  slaHours: { type: Number, default: 24 },
  latitude: { type: Number, default: 12.9258 },
  longitude: { type: Number, default: 77.5838 },
  image: { type: String, default: '' },
  description: { type: String, default: '' },
  assignedCrew: { type: String, default: '' },
  escalated: { type: Boolean, default: false }
}, schemaOptions);

module.exports = mongoose.model('Issue', issueSchema);
