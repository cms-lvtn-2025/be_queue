import { Request, Response } from 'express';
import { serviceQueueManager } from '../../queue/queue';
import { Job } from 'bullmq';

/**
 * Get all queues
 */
export const getAllQueues = async (req: Request, res: Response): Promise<void> => {
  try {
    const allQueues = serviceQueueManager.getAllQueues();

    const queuesData = await Promise.all(
      allQueues.map(async (queueInfo) => {
        const jobCounts = await queueInfo.queue.getJobCounts();

        return {
          name: queueInfo.serviceName,
          type: queueInfo.type,
          jobCounts,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: queuesData,
      count: queuesData.length,
    });
  } catch (error) {
    console.error('[QueuesController] Get all queues error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get queue details
 */
export const getQueueDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;

    const queueInfo = serviceQueueManager.getServiceQueue(name);

    if (!queueInfo) {
      res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
      return;
    }

    const jobCounts = await queueInfo.queue.getJobCounts();

    res.status(200).json({
      success: true,
      data: {
        name: queueInfo.serviceName,
        type: queueInfo.type,
        service: queueInfo.service || null,
        jobCounts,
      },
    });
  } catch (error) {
    console.error('[QueuesController] Get queue details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get jobs in queue
 */
export const getJobsInQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const status = (req.query.status as string) || 'waiting';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const queueInfo = serviceQueueManager.getServiceQueue(name);

    if (!queueInfo) {
      res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
      return;
    }

    let jobs: Job[] = [];

    switch (status) {
      case 'active':
        jobs = await queueInfo.queue.getActive(offset, offset + limit - 1);
        break;
      case 'waiting':
        jobs = await queueInfo.queue.getWaiting(offset, offset + limit - 1);
        break;
      case 'completed':
        jobs = await queueInfo.queue.getCompleted(offset, offset + limit - 1);
        break;
      case 'failed':
        jobs = await queueInfo.queue.getFailed(offset, offset + limit - 1);
        break;
      case 'delayed':
        jobs = await queueInfo.queue.getDelayed(offset, offset + limit - 1);
        break;
      default:
        jobs = await queueInfo.queue.getWaiting(offset, offset + limit - 1);
    }

    const jobsData = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }));

    const total = await queueInfo.queue.getJobCountByTypes(status as any);

    res.status(200).json({
      success: true,
      data: jobsData,
      count: jobsData.length,
      total,
    });
  } catch (error) {
    console.error('[QueuesController] Get jobs in queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Add job to queue
 */
export const addJobToQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const { name: jobName, data, opts } = req.body;

    const queueInfo = serviceQueueManager.getServiceQueue(name);

    if (!queueInfo) {
      res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
      return;
    }

    const job = await queueInfo.queue.add(jobName || 'default', data || {}, opts || {});

    res.status(201).json({
      success: true,
      message: 'Job added to queue successfully',
      data: {
        jobId: job.id,
        queueName: name,
      },
    });
  } catch (error) {
    console.error('[QueuesController] Add job to queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get job status
 */
export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, jobId } = req.params;

    const queueInfo = serviceQueueManager.getServiceQueue(name);

    if (!queueInfo) {
      res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
      return;
    }

    const job = await queueInfo.queue.getJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found',
      });
      return;
    }

    const state = await job.getState();

    res.status(200).json({
      success: true,
      data: {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        state,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      },
    });
  } catch (error) {
    console.error('[QueuesController] Get job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Remove job
 */
export const removeJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, jobId } = req.params;

    const queueInfo = serviceQueueManager.getServiceQueue(name);

    if (!queueInfo) {
      res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
      return;
    }

    const job = await queueInfo.queue.getJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found',
      });
      return;
    }

    await job.remove();

    res.status(200).json({
      success: true,
      message: 'Job removed successfully',
    });
  } catch (error) {
    console.error('[QueuesController] Remove job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Retry failed job
 */
export const retryJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, jobId } = req.params;

    const queueInfo = serviceQueueManager.getServiceQueue(name);

    if (!queueInfo) {
      res.status(404).json({
        success: false,
        message: 'Queue not found',
      });
      return;
    }

    const job = await queueInfo.queue.getJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found',
      });
      return;
    }

    await job.retry();
    const state = await job.getState();

    res.status(200).json({
      success: true,
      message: 'Job retried successfully',
      data: {
        jobId: job.id,
        state,
      },
    });
  } catch (error) {
    console.error('[QueuesController] Retry job error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
