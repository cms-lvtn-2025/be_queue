import { Router } from 'express';
import {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  toggleService,
  deleteService,
  healthCheckService,
} from '../controllers/services.controller';

const router = Router();

// All routes require authentication (middleware added in main router)

router.get('/', getAllServices);
router.get('/:id', getServiceById);
router.post('/', createService);
router.put('/:id', updateService);
router.patch('/:id/toggle', toggleService);
router.delete('/:id', deleteService);
router.post('/:id/health-check', healthCheckService);

export default router;
