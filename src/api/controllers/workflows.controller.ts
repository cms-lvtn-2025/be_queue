import { Request, Response } from 'express';
import { WorkflowModel, CronJobModel } from '../../database/models';
import { serviceQueueManager } from '../../queue/queue';

/**
 * Helper: Parse workflow data (convert string params to objects)
 */
function parseWorkflowData(data: any): any {
  if (typeof data.parentParams === 'string') {
    try {
      data.parentParams = JSON.parse(data.parentParams);
    } catch (e) {
      console.warn('Failed to parse parentParams:', e);
    }
  }

  if (data.children && Array.isArray(data.children)) {
    data.children = data.children.map((child: any) => {
      if (typeof child.params === 'string') {
        try {
          child.params = JSON.parse(child.params);
        } catch (e) {
          try {
            child.params = new Function('return (' + child.params + ')')();
          } catch (e2) {
            console.warn('Failed to parse child.params:', child.params, e2);
          }
        }
      }

      if (typeof child.options === 'string') {
        try {
          child.options = JSON.parse(child.options);
        } catch (e) {
          child.options = {};
        }
      }

      if (child.children && Array.isArray(child.children)) {
        child.children = parseWorkflowData({ children: child.children }).children;
      }

      return child;
    });
  }

  if (typeof data.options === 'string') {
    try {
      data.options = JSON.parse(data.options);
    } catch (e) {
      data.options = {};
    }
  }

  return data;
}

/**
 * Get all workflows
 */
export const getAllWorkflows = async (req: Request, res: Response): Promise<void> => {
  try {
    const workflows = await WorkflowModel.find({}).sort({ createdAt: -1 }).lean();

    // Get cron jobs for each workflow
    const workflowsWithCronJobs = await Promise.all(
      workflows.map(async (workflow) => {
        const cronJob = await CronJobModel.findOne({ WL_id: workflow._id.toString() }).lean();
        return {
          ...workflow,
          cronJob: cronJob || null,
          hasCronJob: !!cronJob,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: workflowsWithCronJobs,
      count: workflowsWithCronJobs.length,
    });
  } catch (error) {
    console.error('[WorkflowsController] Get all workflows error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get workflow by ID
 */
export const getWorkflowById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const workflow = await WorkflowModel.findById(id).lean();

    if (!workflow) {
      res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error('[WorkflowsController] Get workflow by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Create workflow
 */
export const createWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    let workflowData = req.body;

    // Validation
    if (!workflowData.name || !workflowData.parentServiceName || !workflowData.parentMethod) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, parentServiceName, parentMethod',
      });
      return;
    }

    // Parse workflow data
    workflowData = parseWorkflowData(workflowData);

    const newWorkflow = await WorkflowModel.create(workflowData);

    res.status(201).json({
      success: true,
      message: 'Workflow created successfully',
      data: newWorkflow,
    });
  } catch (error) {
    console.error('[WorkflowsController] Create workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Update workflow
 */
export const updateWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let workflowData = req.body;

    // Validation - name is optional for updates
    if (!workflowData.parentServiceName || !workflowData.parentMethod) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: parentServiceName, parentMethod',
      });
      return;
    }

    // Parse workflow data
    workflowData = parseWorkflowData(workflowData);

    const updatedWorkflow = await WorkflowModel.findByIdAndUpdate(id, workflowData, {
      new: true,
      runValidators: true,
    });

    if (!updatedWorkflow) {
      res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Workflow updated successfully',
      data: updatedWorkflow,
    });
  } catch (error) {
    console.error('[WorkflowsController] Update workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Delete workflow
 */
export const deleteWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deletedWorkflow = await WorkflowModel.findByIdAndDelete(id);

    if (!deletedWorkflow) {
      res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
      return;
    }

    // Also delete associated cron jobs
    await CronJobModel.deleteMany({ WL_id: id });

    res.status(200).json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    console.error('[WorkflowsController] Delete workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Execute workflow
 */
export const executeWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const overrideData = req.body.data || {};

    const workflow = await WorkflowModel.findById(id);

    if (!workflow) {
      res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
      return;
    }

    // Execute workflow via MONGODB_WORKFLOW queue
    const queue = serviceQueueManager.getServiceQueue('MONGODB_WORKFLOW');
    if (!queue) {
      res.status(500).json({
        success: false,
        message: 'MONGODB_WORKFLOW queue not found',
      });
      return;
    }

    const job = await queue.queue.add(
      'executeWorkflow',
      {
        workflowId: id,
        ...overrideData,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Workflow executed successfully',
      data: {
        jobId: job.id,
        workflowId: id,
      },
    });
  } catch (error) {
    console.error('[WorkflowsController] Execute workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get available services/queues for workflow editor
 */
export const getAvailableServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const allQueues = serviceQueueManager.getAllQueues();

    const servicesList = {
      fixed: [
        { name: 'QUEUE', type: 'QUEUE', methods: ['EnJob', 'evaluateJob'] },
        {
          name: 'MONGODB_WORKFLOW',
          type: 'WORKFLOW',
          methods: ['findById', 'find', 'findOne', 'create', 'update', 'delete'],
        },
      ],
      static: allQueues
        .filter((q) => q.type === 'static' && q.serviceName !== 'QUEUE' && q.serviceName !== 'MONGODB_WORKFLOW')
        .map((q) => ({
          name: q.serviceName,
          type: 'STATIC',
          methods: q.serviceName.startsWith('MINIO_SERVICE')
            ? ['uploadBuffer', 'getFile', 'deleteFile', 'listFiles', 'generateTemplate1PDF']
            : [],
        })),
      dynamic: allQueues
        .filter((q) => q.type === 'dynamic')
        .map((q) => ({
          name: q.serviceName,
          type: 'DYNAMIC',
          service: q.service,
        })),
    };

    res.status(200).json({
      success: true,
      data: servicesList,
    });
  } catch (error) {
    console.error('[WorkflowsController] Get available services error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
