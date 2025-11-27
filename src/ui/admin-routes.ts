import express, { Request, Response } from 'express';
import { ServiceModel, MinioConfigModel, WorkflowModel, CronJobModel, IService } from '../database/models';
import { MinioService } from '../queue/minio';
import { serviceQueueManager } from '../queue/queue';
import { cronJobService } from '../queue/cronjob/cronjob-service';

const router = express.Router();

/**
 * Helper: Parse workflow data (convert string params to objects)
 */
function parseWorkflowData(data: any): any {
  // Parse parentParams if it's a string
  if (typeof data.parentParams === 'string') {
    try {
      data.parentParams = JSON.parse(data.parentParams);
    } catch (e) {
      console.warn('Failed to parse parentParams:', e);
    }
  }

  // Parse children recursively
  if (data.children && Array.isArray(data.children)) {
    data.children = data.children.map((child: any) => {
      // Parse child params
      if (typeof child.params === 'string') {
        try {
          // Try to parse as JSON
          child.params = JSON.parse(child.params);
        } catch (e) {
          // If parsing fails, try to eval as JavaScript object literal
          try {
            // Use Function constructor to safely evaluate object literal
            child.params = new Function('return (' + child.params + ')')();
          } catch (e2) {
            console.warn('Failed to parse child.params:', child.params, e2);
            // Keep as string if all parsing fails
          }
        }
      }

      // Parse child options
      if (typeof child.options === 'string') {
        try {
          child.options = JSON.parse(child.options);
        } catch (e) {
          child.options = {};
        }
      }

      // Recursively parse nested children
      if (child.children && Array.isArray(child.children)) {
        child.children = parseWorkflowData({ children: child.children }).children;
      }

      return child;
    });
  }

  // Parse options
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
 * GET /admin - BullMQ Dashboard (main page)
 */
router.get('/', (req: Request, res: Response) => {
  res.render('bullmq', {
    title: 'BullMQ Dashboard',
    currentTab: 'bullmq',
    bullmqPath: process.env.BULL_BOARD_PATH || '/admin/queues'
  });
});

/**
 * GET /admin/workflow - Workflow Manager Page (SSR)
 */
router.get('/workflow', async (req: Request, res: Response) => {
  try {
    const workflows = await WorkflowModel.find({}).sort({ createdAt: -1 }).lean();

    // Lấy cron jobs cho mỗi workflow
    const workflowsWithCronJobs = await Promise.all(
      workflows.map(async (workflow) => {
        const cronJob = await CronJobModel.findOne({ WL_id: workflow._id.toString() }).lean();
        return {
          ...workflow,
          cronJob: cronJob || null,
          hasCronJob: !!cronJob
        };
      })
    );

    res.render('workflow', {
      title: 'Workflow Manager',
      currentTab: 'workflow',
      workflows: workflowsWithCronJobs
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.render('workflow', {
      title: 'Workflow Manager',
      currentTab: 'workflow',
      workflows: [],
      error: 'Failed to load workflows'
    });
  }
});

/**
 * GET /admin/workflow/editor/:id? - Workflow Editor Page (SSR)
 */
router.get('/workflow/editor/:id?', async (req: Request, res: Response) => {
  try {
    let workflow = null;

    if (req.params.id) {
      workflow = await WorkflowModel.findById(req.params.id).lean();
    }

    // Lấy danh sách services từ serviceQueueManager
    const allQueues = serviceQueueManager.getAllQueues();

    // Phân loại services theo type
    const servicesList = {
      fixed: [
        { name: 'QUEUE', type: 'QUEUE', methods: ['EnJob', 'evaluateJob'] },
        { name: 'MONGODB_WORKFLOW', type: 'WORKFLOW', methods: ['findById', 'find', 'findOne', 'create', 'update', 'delete'] }
      ],
      static: allQueues
        .filter(q => q.type === 'static' && q.serviceName !== 'QUEUE' && q.serviceName !== 'MONGODB_WORKFLOW')
        .map(q => ({
          name: q.serviceName,
          type: 'STATIC',
          methods: q.serviceName.startsWith('MINIO_SERVICE')
            ? ['uploadBuffer', 'getFile', 'deleteFile', 'listFiles', 'generateTemplate1PDF']
            : []
        })),
      dynamic: allQueues
        .filter(q => q.type === 'dynamic')
        .map(q => ({
          name: q.serviceName,
          type: 'DYNAMIC',
          service: q.service
        }))
    };
    console.log(servicesList.static);
    res.render('workflow-editor', {
      title: 'Workflow Editor',
      currentTab: 'workflow',
      workflow: workflow,
      servicesList: servicesList
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.render('workflow-editor', {
      title: 'Workflow Editor',
      currentTab: 'workflow',
      workflow: null,
      servicesList: { fixed: [], static: [], dynamic: [] },
      error: 'Failed to load workflow'
    });
  }
});

/**
 * POST /admin/workflow - Create new workflow
 */
router.post('/workflow', async (req: Request, res: Response) => {
  try {
    let workflowData = req.body;

    // Validate required fields
    if (!workflowData.parentServiceName || !workflowData.parentMethod) {
      return res.status(400).json({
        error: 'Missing required fields: parentServiceName, parentMethod'
      });
    }

    // Parse workflow data (convert string params to objects)
    workflowData = parseWorkflowData(workflowData);

    console.log('Creating workflow:', JSON.stringify(workflowData, null, 2));

    const newWorkflow = await WorkflowModel.create(workflowData);

    res.status(201).json(newWorkflow);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

/**
 * PUT /admin/workflow/:id - Update existing workflow
 */
router.put('/workflow/:id', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;
    let workflowData = req.body;

    // Validate required fields
    if (!workflowData.parentServiceName || !workflowData.parentMethod) {
      return res.status(400).json({
        error: 'Missing required fields: parentServiceName, parentMethod'
      });
    }

    // Parse workflow data (convert string params to objects)
    workflowData = parseWorkflowData(workflowData);

    console.log('Updating workflow:', workflowId, JSON.stringify(workflowData, null, 2));
    console.log('First child params type:', typeof workflowData.children?.[0]?.params);
    console.log('First child params value:', workflowData.children?.[0]?.params);

    const updatedWorkflow = await WorkflowModel.findByIdAndUpdate(
      workflowId,
      workflowData,
      { new: true, runValidators: true }
    );

    if (!updatedWorkflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(updatedWorkflow);
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

/**
 * DELETE /admin/workflow/:id - Delete workflow
 */
router.delete('/workflow/:id', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;

    const deletedWorkflow = await WorkflowModel.findByIdAndDelete(workflowId);

    if (!deletedWorkflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

/**
 * GET /admin/services - Manager Service Page (SSR)
 */
router.get('/services', async (req: Request, res: Response) => {
  try {
    const services = await ServiceModel.find({}).sort({ serviceName: 1 }).lean();

    res.render('services', {
      title: 'Manager Service',
      currentTab: 'services',
      services: services
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.render('services', {
      title: 'Manager Service',
      currentTab: 'services',
      services: [],
      error: 'Failed to load services'
    });
  }
});

/**
 * POST /admin/api/services - Create a new service
 */
router.post('/api/services', async (req: Request, res: Response) => {
  try {
    const {
      name,
      url,
      port,
      protocol,
      protoPath,
      protoPackage,
      enabled = false,
    } = req.body;

    if (!name || !url || !port || !protocol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, url, port, protocol',
      });
    }

    const service = new ServiceModel({
      name,
      url,
      port,
      protocol,
      protoPath,
      protoPackage,
      enabled,
    });

    await service.save();

    let warning: string | null = null;

    if (service.enabled) {
      try {
        await serviceQueueManager.createServiceQueue(service as IService);
        await serviceQueueManager.healthCheckAndUpdateServiceQueue(
          service as IService
        );
      } catch (error: any) {
        warning = error.message || 'Failed to initialize service queue';
        await serviceQueueManager
          .deleteServiceQueue(service as IService)
          .catch(() => undefined);
        await ServiceModel.updateOne(
          { _id: service._id },
          {
            $set: {
              enabled: false,
              healthy: false,
            },
          }
        );
      }
    }

    const freshService = await ServiceModel.findById(service._id).lean();

    return res.status(201).json({
      success: true,
      data: freshService,
      warning: warning || undefined,
    });
  } catch (error: any) {
    console.error('Error creating service:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create service',
    });
  }
});

/**
 * PATCH /admin/api/services/:id/toggle - Enable or disable a service
 */
router.patch('/api/services/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Field "enabled" must be boolean',
      });
    }

    const service = await ServiceModel.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      });
    }

    if (enabled === service.enabled) {
      const freshService = await ServiceModel.findById(id).lean();
      return res.json({
        success: true,
        data: freshService,
      });
    }

    if (enabled) {
      try {
        await serviceQueueManager.toggleServiceQueue(
          service as IService,
          true
        );
        await ServiceModel.updateOne(
          { _id: service._id },
          {
            $set: {
              enabled: true,
            },
          }
        );
        await serviceQueueManager.healthCheckAndUpdateServiceQueue(
          service as IService
        );
      } catch (error: any) {
        console.error(`Error enabling service ${service.name}:`, error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to enable service',
        });
      }
    } else {
      try {
        await serviceQueueManager.toggleServiceQueue(
          service as IService,
          false
        );
        await ServiceModel.updateOne(
          { _id: service._id },
          {
            $set: {
              enabled: false,
              healthy: false,
            },
          }
        );
      } catch (error: any) {
        console.error(`Error disabling service ${service.name}:`, error);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to disable service',
        });
      }
    }

    const freshService = await ServiceModel.findById(id).lean();

    return res.json({
      success: true,
      data: freshService,
    });
  } catch (error: any) {
    console.error('Error toggling service:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle service',
    });
  }
});

/**
 * DELETE /admin/api/services/:id - Remove a service
 */
router.delete('/api/services/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const service = await ServiceModel.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      });
    }

    try {
      await serviceQueueManager.deleteServiceQueue(service as IService);
    } catch (error) {
      console.warn(`Failed to clean up queues for ${service.name}:`, error);
    }

    await ServiceModel.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting service:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete service',
    });
  }
});

/**
 * GET /admin/minio - Manager MinIO Page (SSR)
 */
router.get('/minio', async (req: Request, res: Response) => {
  try {
    // Lấy data từ MongoDB (đã có connectionStatus được update từ MinioService)
    const configs = await MinioConfigModel.find({}).sort({ name: 1 }).lean();

    res.render('minio', {
      title: 'Manager MinIO',
      currentTab: 'minio',
      minioConfigs: configs
    });
  } catch (error) {
    console.error('Error fetching MinIO configs:', error);
    res.render('minio', {
      title: 'Manager MinIO',
      currentTab: 'minio',
      minioConfigs: [],
      error: 'Failed to load MinIO configs'
    });
  }
});

// ==========================================
// CronJob API Routes
// ==========================================

/**
 * GET /admin/api/cronjobs
 * Lấy tất cả cron jobs
 */
router.get('/api/cronjobs', async (req: Request, res: Response) => {
  try {
    const cronJobs = await cronJobService.getAllCronJobs();
    res.json({
      success: true,
      data: cronJobs,
      count: cronJobs.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /admin/api/cronjobs/with-workflow
 * Lấy tất cả cron jobs kèm thông tin workflow
 */
router.get('/api/cronjobs/with-workflow', async (req: Request, res: Response) => {
  try {
    const cronJobs = await cronJobService.getCronJobsWithWorkflow();
    res.json({
      success: true,
      data: cronJobs,
      count: cronJobs.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /admin/api/cronjobs/workflow/:workflowId
 * Lấy cron job theo workflow ID
 */
router.get('/api/cronjobs/workflow/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const cronJob = await cronJobService.getCronJobByWorkflowId(workflowId);

    if (!cronJob) {
      return res.status(404).json({
        success: false,
        error: 'CronJob not found for this workflow',
      });
    }

    res.json({
      success: true,
      data: cronJob,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /admin/api/cronjobs
 * Tạo cron job mới
 * Body: { workflowId: string, schedule: string, enabled?: boolean }
 */
router.post('/api/cronjobs', async (req: Request, res: Response) => {
  try {
    const { workflowId, schedule, enabled } = req.body;

    if (!workflowId || !schedule) {
      return res.status(400).json({
        success: false,
        error: 'workflowId and schedule are required',
      });
    }

    const cronJob = await cronJobService.createCronJob({
      workflowId,
      schedule,
      enabled,
    });

    res.status(201).json({
      success: true,
      data: cronJob,
      message: 'CronJob created successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /admin/api/cronjobs/:id
 * Cập nhật cron job
 * Body: { schedule?: string, enabled?: boolean }
 */
router.put('/api/cronjobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { schedule, enabled } = req.body;
    console.log('Update cron job:', id, schedule, enabled);
    const cronJob = await cronJobService.updateCronJob(id, {
      schedule,
      enabled,
    });



    res.json({
      success: true,
      data: cronJob,
      message: 'CronJob updated successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /admin/api/cronjobs/:id
 * Xóa cron job
 */
router.delete('/api/cronjobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await cronJobService.deleteCronJob(id);

    res.json({
      success: true,
      message: 'CronJob deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /admin/api/cronjobs/:id/toggle
 * Enable/Disable cron job
 * Body: { enabled: boolean }
 */
router.patch('/api/cronjobs/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    console.log('Toggle cron job:', id, enabled);

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'enabled field is required',
      });
    }

    const cronJob = await cronJobService.toggleCronJob(id, enabled);

    res.json({
      success: true,
      data: cronJob,
      message: `CronJob ${enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
