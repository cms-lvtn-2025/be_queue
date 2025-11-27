import {
  Job,
  FlowProducer,
  FlowJob,
  Queue,
  Worker,
  JobsOptions,
  FlowOpts,
} from "bullmq";
import IORedis from "ioredis";
import {
  IService,
  IWorkflow,
  IWorkflowChildren,
  IWorkflowModel,
  WorkflowModel,
} from "../database/models";
import vm from "node:vm";
// Redis connection
import { v4 as uuidv4 } from "uuid";
import { options } from "pdfkit";
import { ManagerExternalService } from "./external/main";
import { EventEmitter } from "events";

export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "10002"),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
  maxRetriesPerRequest: null,
});

export const serviceQueueEvents = new EventEmitter();

export interface ServiceJobData {
  method: string;
  params: any;
  metadata?: any;
}

export interface ServiceQueueInfo {
  serviceName: string;
  queueName: string;
  queue: Queue<ServiceJobData>;
  worker: Worker<ServiceJobData>;
  client: any; // gRPC client hoặc class instance
  type: "dynamic" | "static"; // dynamic = từ DB, static = manual register
  service?: IService; // Optional - chỉ có khi type = dynamic
}

export interface Children {
  serviceName: string;
  method: string;
  params: any;
  options?: JobsOptions;
  children?: Children[];
}

export interface FlowJobWithId {
  id: string;
  flow: FlowJob;
}

/**
 * Service Queue Manager - Quản lý queue động cho mỗi service
 */
export class ServiceQueueManager {
  private queues: Map<string, ServiceQueueInfo> = new Map();
  private externalServiceManager: ManagerExternalService;

  constructor() {
    this.externalServiceManager = new ManagerExternalService();
  }

  private findQueueEntryByServiceId(
    serviceId: string
  ): [string, ServiceQueueInfo] | undefined {
    for (const entry of this.queues.entries()) {
      const queueInfo = entry[1];
      const queueServiceId = queueInfo.service?._id?.toString();
      if (queueServiceId === serviceId) {
        return entry;
      }
    }
    return undefined;
  }

  getQueueByServiceId(serviceId: string): ServiceQueueInfo | undefined {
    const entry = this.findQueueEntryByServiceId(serviceId);
    return entry ? entry[1] : undefined;
  }
  /**
   * Tạo queue và worker cho một service
   */
  async createServiceQueue(service: IService): Promise<ServiceQueueInfo> {
    this.externalServiceManager.registerExternalService(service);
    const queue = await this.externalServiceManager.createQueue(service);
    const queueInfo: ServiceQueueInfo = {
      serviceName: service.name,
      queueName: service.name,
      queue,
      worker: await this.externalServiceManager.getWorker(service),
      client: this.externalServiceManager.getClient(service),
      type: "dynamic",
      service,
    }; 
    this.queues.set(service.name, queueInfo);
    serviceQueueEvents.emit("queuesChanged");
    return queueInfo;
  }

  async healthCheckAndUpdateServiceQueue(service: IService): Promise<boolean> {
    return this.externalServiceManager.healthCheckAndUpdateService(service);
  }

  async toggleServiceQueue(
    service: IService,
    enable: boolean
  ): Promise<ServiceQueueInfo | null> {
    if (enable) {
      return this.createServiceQueue(service);
    }

    await this.deleteServiceQueue(service);
    return null;
  }

  async deleteServiceQueue(service: IService): Promise<void> {
    let queueKey: string | undefined = service.name;
    let existing = this.queues.get(service.name);

    if ((!existing || !queueKey) && service._id) {
      const entry = this.findQueueEntryByServiceId(service._id.toString());
      if (entry) {
        queueKey = entry[0];
        existing = entry[1];
      }
    }

    await this.externalServiceManager.deleteQueue(service).catch(
      (error: unknown) => {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(
          `Failed to delete external queue for ${service.name}:`,
          message
        );
      }
    );

    await this.externalServiceManager.disconnectService(service).catch(
      (error: unknown) => {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(
          `Failed to disconnect external service for ${service.name}:`,
          message
        );
      }
    );

    await this.externalServiceManager.unregisterService(service).catch(
      (error: unknown) => {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        console.warn(
          `Failed to unregister external service for ${service.name}:`,
          message
        );
      }
    );

    if (existing) {
      try {
        await existing.worker.close();
      } catch (error) {
        console.warn(`Failed to close worker for ${service.name}:`, error);
      }

      try {
        await existing.queue.close();
      } catch (error) {
        console.warn(`Failed to close queue for ${service.name}:`, error);
      }

      if (queueKey) {
        this.queues.delete(queueKey);
      }
      serviceQueueEvents.emit("queuesChanged");
    }
  }
  /**
   * Đăng ký với service mongodb
   */
  createServiceWorkflowQueue(WorkflowModel: IWorkflowModel): ServiceQueueInfo {
    const queueName = `MONGODB_WORKFLOW`;

    const queue = new Queue<ServiceJobData>(queueName, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 50,
        },
      },
    });

    // Tạo Worker với MongoDB model
    const worker = new Worker<ServiceJobData>(
      queueName,
      async (job: Job<ServiceJobData>) => {
        console.log(`\n⚡ [MONGODB] Processing job ${job.id}`);
        console.log(`   Method: ${job.data.method}`);
        console.log(`   Params:`, job.data.params);

        try {
          // Gọi method từ WorkflowModel
          const method = (WorkflowModel as any)[job.data.method];
          if (!method) {
            throw new Error(
              `Method ${job.data.method} not found on MONGODB_WORKFLOW_QUEUE`
            );
          }

          // Call method (bind this context)
          const result = await method.call(
            WorkflowModel,
            job.data.params.params
          );

          let results: any = {
            result: result,
          };
          if (job.data.params?.data) {
            results.data = job.data.params?.data;
          }

          console.log(`   ✅ Success:`, results);
          return results;
        } catch (error: any) {
          console.error(`   ❌ Error:`, error.message);
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3"),
      }
    );
    const queueInfo: ServiceQueueInfo = {
      serviceName: "MONGODB_WORKFLOW",
      queueName,
      queue,
      worker,
      client: WorkflowModel,
      type: "static",
    };
    this.queues.set("MONGODB_WORKFLOW", queueInfo);
    console.log(`✅ Queue created for MONGODB_WORKFLOW`);
    return queueInfo;
  }

  /**
   * Đăng ký static queue với class instance
   * @param serviceName - Tên service (uppercase)
   * @param serviceInstance - Instance của class service
   * @param options - Queue options
   */
  registerStaticQueue(
    serviceName: string,
    serviceInstance: any,
    options?: {
      concurrency?: number;
      attempts?: number;
    }
  ): ServiceQueueInfo {
    const queueName = serviceName;

    console.log(`\n🔧 Registering static queue for ${serviceName}...`);

    // Tạo Queue
    const queue = new Queue<ServiceJobData>(queueName, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: options?.attempts || 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 50,
        },
      },
    });

    // Tạo Worker với service instance
    const worker = new Worker<ServiceJobData>(
      queueName,
      async (job: Job<ServiceJobData>) => {
        console.log(`\n⚡ [${serviceName}] Processing job ${job.id}`);
        console.log(`   Method: ${job.data.method}`);
        console.log(`   Params:`, job.data.params);
        const children = await job.getChildrenValues();

        try {
          console.log("   📦 Children results:", children);
          if (job.data.method == "EnJob") {
            return children;
          }
          // Gọi method từ service instance
          const method = serviceInstance[job.data.method];
          if (!method || typeof method !== "function") {
            throw new Error(
              `Method ${job.data.method} not found on ${serviceName}`
            );
          }
          const addDataForObject = (obj: any, data: any) => {
            if (!obj || typeof obj !== "object") return;
            for (const key in obj) {
              const value = obj[key];
              //  // Parse: @bull:file_service-queue:jobId.file.id
              if (typeof value == "string" && value.startsWith("@bull:")) {
                const cleaned = value.replace("@", ""); // bull:file_service-queue:jobId.file.id
                const [fullJobKey, ...pathParts] = cleaned.split("."); // ["bull:file_service-queue:jobId", "file", "id"]

                // Lấy child result từ children object
                let dataKey = data[fullJobKey]; // children["bull:file_service-queue:jobId"]

                // Navigate qua path (file.id)
                pathParts.forEach((part) => {
                  if (dataKey && typeof dataKey === "object") {
                    dataKey = dataKey[part];
                  }
                });

                obj[key] = dataKey;
                console.log(`   🔄 Resolved ${value} -> ${dataKey}`);
              } else if (typeof value === "object") {
                addDataForObject(value, data);
              } else if (Array.isArray(value)) {
                value.forEach((item: any) => {
                  addDataForObject(item, data);
                });
              }
            }
          };
          if (typeof job.data.params == "object") {
            addDataForObject(job.data.params, children);
          }

          // Call method (bind this context)
          const result =
            job.data.method == "evaluateJob"
              ? await method.call(serviceInstance, job.data.params)
              : await method.call(serviceInstance, job.data.params.params);
          console.log(`   ✅ Success:`, result);
          let results: any = {
            result: result,
          };
          if (job.data.params?.data) {
            results.data = job.data.params?.data;
          }
          return results;
        } catch (error: any) {
          console.error(`   ❌ Error:`, error.message);
          throw error;
        }
      },
      {
        connection: redisConnection,
        lockDuration: 300000, // 5 minutes
        concurrency:
          options?.concurrency ||
          parseInt(process.env.WORKER_CONCURRENCY || "3"),
      }
    );

    // Event listeners
    worker.on("completed", (job) => {
      console.log(`✨ [${serviceName}] Job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
      console.error(`❌ [${serviceName}] Job ${job?.id} failed:`, err.message);
    });

    const queueInfo: ServiceQueueInfo = {
      serviceName: serviceName,
      queueName,
      queue,
      worker,
      client: serviceInstance,
      type: "static",
    };

    this.queues.set(serviceName.toUpperCase(), queueInfo);

    console.log(`✅ Static queue created for ${serviceName}`);
    serviceQueueEvents.emit("queuesChanged");

    return queueInfo;
  }

  /**
   * Lấy queue info của một service
   */
  getServiceQueue(serviceName: string): ServiceQueueInfo | undefined {
    return this.queues.get(serviceName);
  }

  /**
   * Lấy tất cả queues
   */
  getAllQueues(): ServiceQueueInfo[] {
    return Array.from(this.queues.values());
  }

  /**
   * Thêm job vào queue của service
   */
  async addJob(
    serviceName: string,
    data: ServiceJobData,
    options?: JobsOptions
  ): Promise<Job<ServiceJobData>> {
    const queueInfo = this.queues.get(serviceName);
    if (!queueInfo) {
      throw new Error(`Queue for service ${serviceName} not found`);
    }

    const job = await queueInfo.queue.add("grpc-call", data, options);
    console.log(`📝 Added job ${job.id} to ${serviceName} queue`);
    return job;
  }

  /**
   * Đóng tất cả queues và workers
   */
  async closeAll(): Promise<void> {
    console.log("\n🛑 Closing all queues...");

    for (const [name, info] of this.queues.entries()) {
      await info.queue.close();
      await info.worker.close();
      console.log(`  ✅ Closed ${name} queue`);
    }

    await redisConnection.quit();
    console.log("✅ All queues closed");
  }
}

// Singleton instance
export const serviceQueueManager = new ServiceQueueManager();

/**
 * ==========================================
 * Job Management Service - Quản lý job workflows
 * ==========================================
 */
export class QueueService {
  private flowProducer: FlowProducer;

  constructor() {
    // Flow Producer để tạo job hierarchies
    this.flowProducer = new FlowProducer({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "10002"),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || "0"),
      },
    });
  }

  /**
   * Tạo một job đơn giản
   */
  async createJob(
    serviceName: string,
    method: string,
    params: any,
    options?: JobsOptions
  ): Promise<Job<ServiceJobData>> {
    const jobData: ServiceJobData = {
      method,
      params,
      metadata: {
        serviceName,
        createdAt: new Date().toISOString(),
      },
    };

    const job = await serviceQueueManager.addJob(serviceName, jobData, options);

    console.log(`📝 Created job ${job.id} for ${serviceName}.${method}`);
    return job;
  }

  async evaluateJob(params: any): Promise<any> {
    console.log(
      "params in evaluateJob:",
      params,
      typeof params,
      params.code,
      params.returnValue
    );
    if (typeof params === "object" && params.code && params.returnValue) {
      const { v4: uuidv4 } = require("uuid");
      const sandbox = {
        returnValue: params.returnValue,
        data: params.data || {},
        console,
        createJobWithChildren: this.createJobWithChildren.bind(this),
        uuidv4,
        Date,
        findById: WorkflowModel.findById.bind(WorkflowModel),
        addDataForWorkFlow: this.addDataForWorkFlow.bind(this),
      };

      const script = new vm.Script(`
      (async () => {
        ${params.code}
      })()
    `);

      try {
        const result = await script.runInNewContext(sandbox);

        return result;
      } catch (err) {
        console.error("Error evaluating code:", err);
        throw err;
      }
    } else {
      throw new Error(
        "Invalid params: must include code, data, and returnValue"
      );
    }
  }

  public addDataForObject(obj: any, data: any) {
    if (!obj || typeof obj !== "object") return;
    for (const key in obj) {
      const value = obj[key];
      // value have "@__data__:file.createdBy.fullName"
      if (typeof value == "string" && value.startsWith("@__data__:")) {
        const cleaned = value.replace("@__data__:", ""); // file.createdBy.fullName
        const [fullJobKey, ...pathParts] = cleaned.split("."); // ["file", "createdBy", "fullName"]
        if (fullJobKey === "") {
          obj[key] = data;
        } else {
          // Lấy child result từ children object
          let dataKey = data[fullJobKey]; // children["file"]

          // Navigate qua path (file.id)
          pathParts.forEach((part) => {
            if (dataKey && typeof dataKey === "object") {
              dataKey = dataKey[part];
            }
          });
          obj[key] = dataKey;
        }
      } else if (typeof value === "object") {
        this.addDataForObject(value, data);
      }
    }
  }

  public addDataForWorkFlowChildren(children: IWorkflowChildren[], data: any) {
    for (const child of children) {
      if (child.params && typeof child.params === "object") {
        this.addDataForObject(child.params, data);
      }
      if (child.children && Array.isArray(child.children)) {
        this.addDataForWorkFlowChildren(child.children, data);
      }
    }
  }

  public addDataForWorkFlow(workFlow: IWorkflow, data: any) {
    if (typeof data !== "object") return;
    if (workFlow?.parentParams && typeof workFlow.parentParams === "object") {
      Object.entries(workFlow.parentParams).forEach(([key, value]) => {
        // value have "@__data__:file.createdBy.fullName"
        if (typeof value == "string" && value.startsWith("@__data__:")) {
          const cleaned = value.replace("@__data__:", ""); // file.createdBy.fullName
          const [fullJobKey, ...pathParts] = cleaned.split("."); // ["file", "createdBy", "fullName"]
          if (fullJobKey === "") {
            workFlow.parentParams[key] = data;
          } else {
            // Lấy child result từ children object
            let dataKey = data[fullJobKey]; // children["file"]
            // Navigate qua path (file.id)
            pathParts.forEach((part) => {
              if (dataKey && typeof dataKey === "object") {
                dataKey = dataKey[part];
              }
            });
            workFlow.parentParams[key] = dataKey;
          }
        }
      });
    }
    this.addDataForWorkFlowChildren(workFlow.children, data);
  }

  /**
   * Params add id of child job
   */
  public async addIdOfChildJob(params: any, flowJobWithId: FlowJobWithId[]) {
    if (typeof params === "object") {
      Object.entries(params).forEach(([key, value]) => {
        // value have "@__id__{index}:..."
        if (typeof value == "string" && value.startsWith("@__id__")) {
          const match = value.match(/^@__id__(\d+):(.*)$/);
          console.log(match);
          if (match) {
            const index = parseInt(match[1], 10);
            let dataKey = flowJobWithId[index];
            params[key] = `@bull:${dataKey.flow.queueName}:${dataKey.id}${
              match[2] ? "." : ""
            }${match[2]}`;
          }
        } else if (typeof value == "object") {
          this.addIdOfChildJob(value, flowJobWithId);
        }
      });
    }
  }

  /**
   * Tạo job với child jobs (parent-child relationship)
   * Parent job chờ tất cả child jobs hoàn thành
   */
  /**
   * Helper function để tạo FlowJob đệ quy (support nested children)
   */
  private buildFlowJob(
    child: Children,
    index: number,
    parentServiceName?: string
  ): FlowJobWithId {
    const queueName = `${child.serviceName}`;

    // Đệ quy xử lý children của child (grandchildren)
    const grandChildren: FlowJobWithId[] | undefined = child.children
      ? child.children.map((grandChild, idx) =>
          this.buildFlowJob(grandChild, idx, child.serviceName)
        )
      : undefined;
    const id = uuidv4();
    console.log(child.params);
    this.addIdOfChildJob(child.params, grandChildren || []);
    console.log("After addIdOfChildJob:", child.params);
    return {
      id: id,
      flow: {
        name: `child-${index}`,
        queueName,
        data: {
          method: child.method,
          params: child.params,
          metadata: {
            serviceName: child.serviceName,
            parentService: parentServiceName,
            hasChildren: !!grandChildren,
          },
        },
        opts: {
          jobId: id,
          ...child.options,
        },
        children: grandChildren?.map((value) => value.flow), // ✅ Nested children support
      },
    };
  }

  async createJobWithChildren(
    parentServiceName: string,
    parentMethod: string,
    parentParams: any,
    children: Children[],
    options?: JobsOptions,
    FlowOpts?: FlowOpts
  ): Promise<any> {
    const queueName = `${parentServiceName}`;

    // Tạo child jobs với đệ quy support
    const childJobs: FlowJobWithId[] = children.map((child, index) =>
      this.buildFlowJob(child, index, parentServiceName)
    );

    // Tạo parent job với children
    const flow = await this.flowProducer.add(
      {
        name: "parent",
        queueName,
        data: {
          method: parentMethod,
          params: parentParams,
          metadata: {
            serviceName: parentServiceName,
            hasChildren: true,
          },
        },
        children: childJobs.map((value) => value.flow),
        opts: {

          ...options,
        },
      },
      FlowOpts
    );

    // Đếm tổng số jobs (bao gồm cả nested)
    const countJobs = (children: Children[]): number => {
      return children.reduce((total, child) => {
        return total + 1 + (child.children ? countJobs(child.children) : 0);
      }, 0);
    };
    const totalJobs = countJobs(children);

    console.log(
      `📝 Created parent job with ${children.length} direct children (${totalJobs} total jobs) for ${parentServiceName}.${parentMethod}`
    );
    return flow;
  }

  /**
   * Get job với children results
   */
  async getJobWithChildren(serviceName: string, jobId: string): Promise<any> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const job = await queueInfo.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const childrenValues = await job.getChildrenValues();

    // Parse children results
    const children = Object.entries(childrenValues).map(([jobId, result]) => ({
      jobId,
      result,
    }));

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      returnValue: job.returnvalue,
      children,
      childrenCount: children.length,
    };
  }

  /**
   * Get children results only (helper)
   */
  async getChildrenResults(serviceName: string, jobId: string): Promise<any[]> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const job = await queueInfo.queue.getJob(jobId);
    if (!job) {
      return [];
    }

    const childrenValues = await job.getChildrenValues();

    // Trả về array của results
    return Object.values(childrenValues);
  }

  /**
   * Get job status
   */
  async getJobStatus(serviceName: string, jobId: string): Promise<any> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const job = await queueInfo.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      returnValue,
      failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Cancel/Remove a job
   */
  async cancelJob(serviceName: string, jobId: string): Promise<void> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const job = await queueInfo.queue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`🗑️  Cancelled job ${jobId} from ${serviceName}`);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(serviceName: string, jobId: string): Promise<void> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const job = await queueInfo.queue.getJob(jobId);
    if (job) {
      await job.retry();
      console.log(`🔄 Retrying job ${jobId} from ${serviceName}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(serviceName: string): Promise<any> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const queue = queueInfo.queue;

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      serviceName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get all queues stats
   */
  async getAllQueuesStats(): Promise<any[]> {
    const allQueues = serviceQueueManager.getAllQueues();

    const stats = await Promise.all(
      allQueues.map(async (queueInfo) => {
        return this.getQueueStats(queueInfo.serviceName);
      })
    );

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(serviceName: string): Promise<void> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    await queueInfo.queue.pause();
    console.log(`⏸️  Paused queue for ${serviceName}`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(serviceName: string): Promise<void> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    await queueInfo.queue.resume();
    console.log(`▶️  Resumed queue for ${serviceName}`);
  }

  /**
   * Clean completed jobs
   */
  async cleanCompletedJobs(
    serviceName: string,
    olderThanMs: number = 3600000
  ): Promise<void> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    await queueInfo.queue.clean(olderThanMs, 100, "completed");
    console.log(`🧹 Cleaned completed jobs for ${serviceName}`);
  }

  /**
   * Clean failed jobs
   */
  async cleanFailedJobs(
    serviceName: string,
    olderThanMs: number = 3600000
  ): Promise<void> {
    const queueInfo = serviceQueueManager.getServiceQueue(serviceName);
    if (!queueInfo) {
      throw new Error(`Service ${serviceName} not found`);
    }

    await queueInfo.queue.clean(olderThanMs, 100, "failed");
    console.log(`🧹 Cleaned failed jobs for ${serviceName}`);
  }

  /**
   * Close flow producer
   */
  async close(): Promise<void> {
    await this.flowProducer.close();
  }
}

// Singleton instance
export const queueService = new QueueService();
