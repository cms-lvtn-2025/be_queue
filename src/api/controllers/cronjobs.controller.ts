import { Request, Response } from 'express';
import { CronJobModel } from '../../database/models';
import { initializeCronJobs } from '../../queue/cronjob/cronjob-init';

/**
 * Get all cron jobs
 */
export const getAllCronJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabled } = req.query;

    const filter: any = {};
    if (enabled !== undefined) {
      filter.enabled = enabled === 'true';
    }

    const cronJobs = await CronJobModel.find(filter)
      .populate('WL_id')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: cronJobs,
      count: cronJobs.length,
    });
  } catch (error) {
    console.error('[CronJobsController] Get all cron jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Create cron job
 */
export const createCronJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, cronExpression, WL_id, enabled = true } = req.body;

    // Validation
    if (!cronExpression || !WL_id) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: cronExpression, WL_id',
      });
      return;
    }

    const cronJob = await CronJobModel.create({
      schedule: cronExpression, // Map cronExpression to schedule field
      WL_id,
      enabled,
    });

    // Reinitialize all cron jobs if this one is enabled
    if (enabled) {
      try {
        await initializeCronJobs();
      } catch (cronError) {
        console.error('[CronJobsController] Failed to initialize cron jobs:', cronError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Cron job created successfully',
      data: cronJob,
    });
  } catch (error) {
    console.error('[CronJobsController] Create cron job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Update cron job
 */
export const updateCronJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const cronJob = await CronJobModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!cronJob) {
      res.status(404).json({
        success: false,
        message: 'Cron job not found',
      });
      return;
    }

    // Reinitialize cron jobs
    try {
      await initializeCronJobs();
    } catch (cronError) {
      console.error('[CronJobsController] Failed to update cron job:', cronError);
    }

    res.status(200).json({
      success: true,
      message: 'Cron job updated successfully',
      data: cronJob,
    });
  } catch (error) {
    console.error('[CronJobsController] Update cron job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Toggle cron job
 */
export const toggleCronJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const cronJob = await CronJobModel.findById(id);

    if (!cronJob) {
      res.status(404).json({
        success: false,
        message: 'Cron job not found',
      });
      return;
    }

    cronJob.enabled = !cronJob.enabled;
    await cronJob.save();

    // Reinitialize cron jobs
    try {
      await initializeCronJobs();
    } catch (cronError) {
      console.error('[CronJobsController] Failed to toggle cron job:', cronError);
    }

    res.status(200).json({
      success: true,
      message: 'Cron job toggled successfully',
      data: {
        id: cronJob._id,
        enabled: cronJob.enabled,
      },
    });
  } catch (error) {
    console.error('[CronJobsController] Toggle cron job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Delete cron job
 */
export const deleteCronJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const cronJob = await CronJobModel.findByIdAndDelete(id);

    if (!cronJob) {
      res.status(404).json({
        success: false,
        message: 'Cron job not found',
      });
      return;
    }

    // Reinitialize cron jobs
    try {
      await initializeCronJobs();
    } catch (cronError) {
      console.error('[CronJobsController] Failed to reinitialize after delete:', cronError);
    }

    res.status(200).json({
      success: true,
      message: 'Cron job deleted successfully',
    });
  } catch (error) {
    console.error('[CronJobsController] Delete cron job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
