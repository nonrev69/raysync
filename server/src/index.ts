import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import masterDataRoutes from './routes/masterData.js';
import jobRoutes from './routes/jobs.js';
import dashboardRoutes from './routes/dashboard.js';
import quoteRoutes from './routes/quotes.js';
import recurringRoutes from './routes/recurring.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3030', 10);

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', masterDataRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/recurring', recurringRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('SERVER ERROR:', err.stack);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`RaySync server running on port ${PORT}`);
});

export default app;
