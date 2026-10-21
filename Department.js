const mongoose = require('mongoose');
const { schemaOptions } = require('./options');

const departmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  color: { type: String, default: '#087f73' },
  activeCrews: { type: Number, default: 5 },
  openIssues: { type: Number, default: 0 }
}, schemaOptions);

module.exports = mongoose.model('Department', departmentSchema);
