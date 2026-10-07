import express from 'express';
import cors from 'cors';
import pool from './db.js';

// Import Routes
import dashboardRoutes from './routes/dashboardRoutes.js';
import outputProcessRoutes from './routes/outputProcessRoutes.js';
import outputProductRoutes from './routes/outputProductRoutes.js';
import planningRoutes from './routes/planningRoutes.js';
import sharedRoutes from './routes/sharedRoutes.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ Database ได้! สาเหตุ:', err.message);
  } else {
    console.log('✅ เชื่อมต่อ Database สำเร็จแล้ว! เวลา Server:', res.rows[0].now);
  }
});

// Use Routes
// Note: All routes were previously prefixed with /api, we keep it the same
app.use('/api', dashboardRoutes);
app.use('/api', outputProcessRoutes);
app.use('/api', outputProductRoutes);
app.use('/api', planningRoutes);
app.use('/api', sharedRoutes);

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another program. Please close it or change the PORT in .env`);
  } else {
    console.error(`❌ Server Error:`, err.message);
  }
});
