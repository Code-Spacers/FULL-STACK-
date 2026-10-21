const mongoose = require('mongoose');
const { schemaOptions } = require('./options');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, default: 'Citizen' },
  department: { type: String, default: '' },
  ward: { type: String, default: 'Ward 153' },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, default: '+91 80 5550 1530' },
  password: { type: String, default: 'nivara123' }
}, schemaOptions);

module.exports = mongoose.model('User', userSchema);
