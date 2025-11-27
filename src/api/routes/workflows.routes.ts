import { Router } from 'express';
import {
  getAllWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  getAvailableServices,
} from '../controllers/workflows.controller';

const router = Router();

// All routes require authentication (middleware added in main router)

router.get('/', getAllWorkflows);
router.get('/services', getAvailableServices); // Get available services for workflow editor
router.get('/:id', getWorkflowById);
router.post('/', createWorkflow);
router.put('/:id', updateWorkflow);
router.delete('/:id', deleteWorkflow);
router.post('/:id/execute', executeWorkflow);

export default router;
