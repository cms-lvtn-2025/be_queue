import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';

// Import all route modules
import authRoutes from './auth.routes';
import servicesRoutes from './services.routes';
import workflowsRoutes from './workflows.routes';
import cronjobsRoutes from './cronjobs.routes';
import minioRoutes from './minio.routes';
import queuesRoutes from './queues.routes';

const router = Router();

/**
 * Public routes (no authentication required)
 */
router.use('/auth', authRoutes);

/**
 * Protected routes (authentication required)
 */
router.use('/services', authenticateToken, servicesRoutes);
router.use('/workflows', authenticateToken, workflowsRoutes);
router.use('/cronjobs', authenticateToken, cronjobsRoutes);
router.use('/minio', authenticateToken, minioRoutes);
router.use('/queues', authenticateToken, queuesRoutes);

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * 404 handler for API routes
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
  });
});

export default router;
