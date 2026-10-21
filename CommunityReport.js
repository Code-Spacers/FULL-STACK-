const mongoose = require('mongoose');
const { schemaOptions } = require('./options');

const communityReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, default: 'Road damage' },
  location: { type: mongoose.Schema.Types.Mixed, default: 'Bengaluru' },
  summary: { type: String, default: '' },
  postedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  subreddit: { type: String, default: 'r/Bengaluru' },
  sourceUrl: { type: String, default: '' },
  embedUrl: { type: String, default: '' },
  upvotes: { type: Number, default: 1 },
  confirmations: { type: Number, default: 1 }
}, schemaOptions);

module.exports = mongoose.model('CommunityReport', communityReportSchema);
