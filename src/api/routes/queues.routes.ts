import { Router } from 'express';
import {
  getAllQueues,
  getQueueDetails,
  getJobsInQueue,
  addJobToQueue,
  getJobStatus,
  removeJob,
  retryJob,
} from '../controllers/queues.controller';

const router = Router();

// All routes require authentication (middleware added in main router)

router.get('/', getAllQueues);
router.get('/:name', getQueueDetails);
router.get('/:name/jobs', getJobsInQueue);
router.post('/:name/jobs', addJobToQueue);
router.get('/:name/jobs/:jobId', getJobStatus);
router.delete('/:name/jobs/:jobId', removeJob);
router.post('/:name/jobs/:jobId/retry', retryJob);

export default router;
