import { Request, Response } from 'express';
import { ServiceModel } from '../../database/models';
import { serviceQueueManager } from '../../queue/queue';

/**
 * Get all services
 */
export const getAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled, healthy, protocol } = req.query;

    // Build filter
    const filter: any = {};
    if (enabled !== undefined) {
      filter.enabled = enabled === 'true';
    }
    if (healthy !== undefined) {
      filter.healthy = healthy === 'true';
    }
    if (protocol) {
      filter.protocol = protocol;
    }

    const services = await ServiceModel.find(filter).sort({ name: 1 }).lean();

    res.status(200).json({
      success: true,
      data: services,
      count: services.length,
    });
  } catch (error) {
    console.error('[ServicesController] Get all services error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get service by ID
 */
export const getServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const service = await ServiceModel.findById(id).lean();

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'Service not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error('[ServicesController] Get service by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Create new service
 */
export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, url, port, protocol, protoPath, protoPackage, enabled = false } = req.body;

    // Validation
    if (!name || !url || !port || !protocol) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, url, port, protocol',
      });
      return;
    }

    // Check if service already exists
    const existingService = await ServiceModel.findOne({ name: name.toUpperCase() });
    if (existingService) {
      res.status(400).json({
        success: false,
        message: 'Service with this name already exists',
      });
      return;
    }

    // Create service
    const service = await ServiceModel.create({
      name: name.toUpperCase(),
      url,
      port,
      protocol,
      protoPath,
      protoPackage,
      enabled,
      healthy: false,
    });

    // Register queue if enabled
    if (enabled) {
      try {
        await serviceQueueManager.createServiceQueue(service);
      } catch (queueError) {
        console.error('[ServicesController] Failed to register queue:', queueError);
        // Don't fail service creation if queue registration fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service,
    });
  } catch (error) {
    console.error('[ServicesController] Create service error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Update service
 */
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const service = await ServiceModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'Service not found',
      });
      return;
    }

    // Update queue if enabled status changed
    if (updates.enabled !== undefined) {
      try {
        if (updates.enabled) {
          await serviceQueueManager.createServiceQueue(service);
        } else {
          await serviceQueueManager.deleteServiceQueue(service);
        }
      } catch (queueError) {
        console.error('[ServicesController] Failed to update queue:', queueError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service,
    });
  } catch (error) {
    console.error('[ServicesController] Update service error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Toggle service enabled/disabled
 */
export const toggleService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const service = await ServiceModel.findById(id);

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'Service not found',
      });
      return;
    }

    // Toggle enabled status
    service.enabled = !service.enabled;
    await service.save();

    // Update queue
    try {
      if (service.enabled) {
        await serviceQueueManager.createServiceQueue(service);
      } else {
        await serviceQueueManager.deleteServiceQueue(service);
      }
    } catch (queueError) {
      console.error('[ServicesController] Failed to toggle queue:', queueError);
    }

    res.status(200).json({
      success: true,
      message: 'Service toggled successfully',
      data: {
        id: service._id,
        enabled: service.enabled,
      },
    });
  } catch (error) {
    console.error('[ServicesController] Toggle service error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Delete service
 */
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const service = await ServiceModel.findByIdAndDelete(id);

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'Service not found',
      });
      return;
    }

    // Delete queue
    try {
      await serviceQueueManager.deleteServiceQueue(service);
    } catch (queueError) {
      console.error('[ServicesController] Failed to delete queue:', queueError);
    }

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('[ServicesController] Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Health check service
 */
export const healthCheckService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const service = await ServiceModel.findById(id);

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'Service not found',
      });
      return;
    }

    // Perform health check via queue manager
    let healthy = false;
    try {
      healthy = await serviceQueueManager.healthCheckAndUpdateServiceQueue(service);
    } catch (error) {
      console.error('[ServicesController] Health check failed:', error);
      healthy = false;
    }

    // Update service health status
    service.healthy = healthy;
    service.lastHealthCheck = new Date();
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Health check completed',
      data: {
        id: service._id,
        healthy: service.healthy,
        lastHealthCheck: service.lastHealthCheck,
      },
    });
  } catch (error) {
    console.error('[ServicesController] Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
