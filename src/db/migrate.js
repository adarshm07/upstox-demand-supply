// Run once: node src/db/migrate.js
const { sequelize, connectDB } = require('./database');
require('./models/Trade');

async function migrate() {
  await connectDB();
  await sequelize.sync({ alter: true });
  console.log('✅ Tables created/updated');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});