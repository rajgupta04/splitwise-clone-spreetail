const app = require('./src/app');
const env = require('./src/config/env');

const PORT = env.PORT;

app.listen(PORT, () => {
  const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`\n🚀 Splitwise Clone API running on ${host}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Health check: ${host}/api/health\n`);
});
