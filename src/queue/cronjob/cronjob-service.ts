import { v4 as uuidv4 } from "uuid";
import { CronJobModel, ICronJob, WorkflowModel } from "../../database/models";
import { queueService, serviceQueueManager } from "../queue";

/**
 * CronJob Service - Quản lý cron jobs cho workflows
 */
export class CronJobService {
  /**
   * Tạo cron job mới cho workflow
   */
  async createCronJob(data: {
    workflowId: string;
    schedule: string;
    enabled?: boolean;
  }): Promise<ICronJob> {
    const { workflowId, schedule, enabled = true } = data;

    // Kiểm tra workflow có tồn tại không
    const workflow = await WorkflowModel.findById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found with ID: ${workflowId}`);
    }

    // Kiểm tra xem workflow đã có cron job chưa
    const existingCronJob = await CronJobModel.findOne({ WL_id: workflowId });
    if (existingCronJob) {
      throw new Error(
        `CronJob already exists for workflow ${workflowId}. Use update instead.`
      );
    }

    // Tạo unique job ID
    const jobId = uuidv4();

    // Tạo repeatable job trong BullMQ
    await queueService.createJob(
      "QUEUE",
      "evaluateJob",
      {
        code: `
          const workflow = await findById("${workflowId}");
          if (!workflow) {
            throw new Error("Workflow not found with ID: ${workflowId}");
          }
          await createJobWithChildren(
            workflow.parentServiceName,
            workflow.parentMethod,
            workflow.parentParams,
            workflow.children,
            workflow.options
          );
          return "Successfully created child jobs for workflow ID: ${workflowId}";
        `,
        returnValue: {
          workflowId: workflowId,
        },
      },
      {
        jobId: jobId,
        repeat: {
          pattern: schedule,
        },
      }
    );

    // Lưu vào database
    const cronJob = await CronJobModel.create({
      WL_id: workflowId,
      schedule,
      enabled,
      idJobCureent: jobId,
    });

    console.log(`✅ Created cron job for workflow ${workflowId}: ${schedule}`);
    return cronJob;
  }

  /**
   * Xóa cron job
   */
  async deleteCronJob(cronJobId: string): Promise<void> {
    const cronJob = await CronJobModel.findById(cronJobId);
    if (!cronJob) {
      throw new Error(`CronJob not found with ID: ${cronJobId}`);
    }

    // Xóa repeatable job trong BullMQ
    try {
      const queueInfo = serviceQueueManager.getServiceQueue("QUEUE");
      if (queueInfo) {
        // Lấy tất cả repeatable jobs và tìm job match với schedule
        const repeatableJobs = await queueInfo.queue.getRepeatableJobs();

        for (const job of repeatableJobs) {
          // Match bằng cron pattern
          if (job.pattern === cronJob.schedule && job.id === cronJob.idJobCureent) {
            // Xóa bằng key của BullMQ
            await queueInfo.queue.removeRepeatableByKey(job.key);
            console.log(`🗑️  Removed repeatable job with key: ${job.key}`);
            break;
          }
        }
      }
    } catch (error: any) {
      console.warn(
        `⚠️  Could not remove repeatable job: ${error.message}`
      );
    }

    // Xóa khỏi database
    await CronJobModel.findByIdAndDelete(cronJobId);
    console.log(`✅ Deleted cron job: ${cronJobId}`);
  }

  /**
   * Cập nhật cron job (xóa cũ, tạo mới)
   */
  async updateCronJob(
    cronJobId: string,
    data: {
      schedule?: string;
      enabled?: boolean;
    }
  ): Promise<ICronJob> {
    const cronJob = await CronJobModel.findById(cronJobId);
    if (!cronJob) {
      throw new Error(`CronJob not found with ID: ${cronJobId}`);
    }

    const workflowId = cronJob.WL_id;
    const newSchedule = data.schedule || cronJob.schedule;
    const newEnabled = data.enabled !== undefined ? data.enabled : cronJob.enabled;

    // Xóa cron job cũ trong BullMQ
    try {
      const queueInfo = serviceQueueManager.getServiceQueue("QUEUE");
      if (queueInfo) {
        const repeatableJobs = await queueInfo.queue.getRepeatableJobs();
        // console.log(`   Found ${repeatableJobs.length} repeatable jobs in queue`);

        for (const job of repeatableJobs) {
          console.log(`   Checking job: pattern=${job.pattern}, id=${job.id}, key=${job.key}`);
          if (job.pattern === cronJob.schedule && job.id === cronJob.idJobCureent) {
            await queueInfo.queue.removeRepeatableByKey(job.key);
            console.log(`🗑️  Removed old repeatable job with key: ${job.key}`);
            break;
          }
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  Could not remove old job: ${error.message}`);
    }

    // Nếu enabled = true, tạo job mới
    let newJobId = cronJob.idJobCureent;
    if (newEnabled) {
      newJobId = uuidv4();

      await queueService.createJob(
        "QUEUE",
        "evaluateJob",
        {
          code: `
            const workflow = await findById("${workflowId}");
            if (!workflow) {
              throw new Error("Workflow not found with ID: ${workflowId}");
            }
            await createJobWithChildren(
              workflow.parentServiceName,
              workflow.parentMethod,
              workflow.parentParams,
              workflow.children,
              workflow.options
            );
            return "Successfully created child jobs for workflow ID: ${workflowId}";
          `,
          returnValue: {
            workflowId: workflowId,
          },
        },
        {
          jobId: newJobId,
          repeat: {
            pattern: newSchedule,
          },
        }
      );
      console.log(`✅ Created new repeatable job: ${newJobId}`);
    }

    // Cập nhật database
    cronJob.schedule = newSchedule;
    cronJob.enabled = newEnabled;
    cronJob.idJobCureent = newJobId;
    await cronJob.save();

    console.log(`✅ Updated cron job: ${cronJobId}`);
    return cronJob;
  }

  /**
   * Lấy cron job theo workflow ID
   */
  async getCronJobByWorkflowId(workflowId: string): Promise<ICronJob | null> {
    return await CronJobModel.findOne({ WL_id: workflowId });
  }

  /**
   * Lấy tất cả cron jobs
   */
  async getAllCronJobs(): Promise<ICronJob[]> {
    return await CronJobModel.find().sort({ createdAt: -1 });
  }

  /**
   * Enable/Disable cron job
   */
  async toggleCronJob(cronJobId: string, enabled: boolean): Promise<ICronJob> {
    console.log(`🔄 Toggle cron job: ${cronJobId} -> enabled=${enabled}`);
    const cronJob = await CronJobModel.findById(cronJobId);
    if (!cronJob) {
      throw new Error(`CronJob not found with ID: ${cronJobId}`);
    }
    console.log(`   CronJob details: WL_id=${cronJob.WL_id}, schedule=${cronJob.schedule}, idJobCureent=${cronJob.idJobCureent}`);

    return await this.updateCronJob(cronJobId, { enabled });
  }

  /**
   * Lấy cron jobs với thông tin workflow
   */
  async getCronJobsWithWorkflow(): Promise<any[]> {
    const cronJobs = await CronJobModel.find().lean();

    const result = await Promise.all(
      cronJobs.map(async (cronJob) => {
        const workflow = await WorkflowModel.findById(cronJob.WL_id).lean();
        return {
          ...cronJob,
          workflow: workflow || null,
        };
      })
    );

    return result;
  }
}

// Singleton instance
export const cronJobService = new CronJobService();
