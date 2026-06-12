const app = require('./src/app');
const env = require('./src/config/env');

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`\n🚀 Splitwise Clone API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
