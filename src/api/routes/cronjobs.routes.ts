import { Router } from 'express';
import {
  getAllCronJobs,
  createCronJob,
  updateCronJob,
  toggleCronJob,
  deleteCronJob,
} from '../controllers/cronjobs.controller';

const router = Router();

// All routes require authentication (middleware added in main router)

router.get('/', getAllCronJobs);
router.post('/', createCronJob);
router.put('/:id', updateCronJob);
router.patch('/:id/toggle', toggleCronJob);
router.delete('/:id', deleteCronJob);

export default router;
