import { Router } from 'express';
import {
  getAllMinioConfigs,
  createMinioConfig,
  updateMinioConfig,
  deleteMinioConfig,
  testMinioConnection,
} from '../controllers/minio.controller';

const router = Router();

// All routes require authentication (middleware added in main router)

router.get('/', getAllMinioConfigs);
router.post('/', createMinioConfig);
router.put('/:id', updateMinioConfig);
router.delete('/:id', deleteMinioConfig);
router.post('/:id/test', testMinioConnection);

export default router;
