const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

const User = require('../models/User');
const Department = require('../models/Department');
const Issue = require('../models/Issue');
const Report = require('../models/Report');
const CommunityReport = require('../models/CommunityReport');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function loadDataFile(filename) {
  const candidates = [
    path.join(__dirname, '..', 'data', filename),
    path.join(__dirname, '..', '..', 'Nivara', 'data', filename)
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`[Seeder] Loaded ${content.length} records from ${filePath}`);
      return content;
    }
  }
  return [];
}

const importData = async () => {
  try {
    await connectDB();

    await User.deleteMany();
    await Department.deleteMany();
    await Issue.deleteMany();
    await Report.deleteMany();
    await CommunityReport.deleteMany();

    const users = loadDataFile('users.json');
    const departments = loadDataFile('departments.json');
    const issues = loadDataFile('issues.json');
    const reports = loadDataFile('reports.json');
    const communityReports = loadDataFile('community-reports.json');

    if (users.length) await User.insertMany(users);
    if (departments.length) await Department.insertMany(departments);
    if (issues.length) await Issue.insertMany(issues);
    if (reports.length) await Report.insertMany(reports);
    if (communityReports.length) await CommunityReport.insertMany(communityReports);

    console.log('✅ [Seeder] All Nivara collections imported into MongoDB without errors!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ [Seeder] Error importing data: ${error.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await connectDB();
    await User.deleteMany();
    await Department.deleteMany();
    await Issue.deleteMany();
    await Report.deleteMany();
    await CommunityReport.deleteMany();
    console.log('🗑️ [Seeder] All Nivara MongoDB collections cleared!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ [Seeder] Error destroying data: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
