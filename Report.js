const mongoose = require('mongoose');
const { schemaOptions } = require('./options');

const reportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, default: 'Pothole' },
  status: { type: String, default: 'Reported' },
  priority: { type: String, default: 'Medium' },
  location: { type: mongoose.Schema.Types.Mixed, default: 'Bengaluru' },
  ward: { type: String, default: 'Ward 153' },
  department: { type: String, default: 'Roads & Civil Works' },
  reportedAt: { type: String, default: () => new Date().toLocaleString() },
  slaHours: { type: Number, default: 24 },
  latitude: { type: Number, default: 12.9258 },
  longitude: { type: Number, default: 77.5838 },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  // The frontend keeps a structured timeline — { at, status, note } — so this
  // must be Mixed; a [String] cast would flatten every entry to "[object Object]".
  updates: { type: [mongoose.Schema.Types.Mixed], default: ['Report received'] },
  escalated: { type: Boolean, default: false }
}, schemaOptions);

module.exports = mongoose.model('Report', reportSchema);
