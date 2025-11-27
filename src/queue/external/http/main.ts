import { DefaultJobOptions, Job, Queue, Worker } from "bullmq";
import { IService, ServiceModel } from "../../../database";
import { ExternalService } from "../baseExternal";
import axios, { AxiosInstance } from "axios";
import { redisConnection, ServiceJobData } from "../../queue";


export class HttpService extends ExternalService {
  public name = "http";
  public version = "v.0.0.1";

  constructor(service: IService) {
    super(service);
  }

  

  public async createClient(): Promise<any> {
    this.client = axios.create({
      baseURL: this.service.protocol === "https" ? "https://" + this.service.url : "http://" + this.service.url,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return this.client;
  }
  public async updateClient(): Promise<any> {
    return this.createClient();
  }
  public async deleteClient(): Promise<any> {
    this.client = undefined;
  }
  public async ping(): Promise<boolean> {
    if (!this.client) {
      console.error(`${this.service.name} ping failed: client not initialized`);
      return false;
    }
    try {
      const response = await this.client.get("/");
      return response.status === 200;
    } catch (error: any) {
      console.error(`${this.service.name} ping failed:`, error.message);
      return false;
    }
  }

  public async healthCheckAndUpdateClient(): Promise<boolean> {
    const isHealthy = await this.ping();
    if (isHealthy) {
      await ServiceModel.updateOne(
        { _id: this.service._id },
        {
          $set: {
            healthy: isHealthy,
            lastHealthCheck: new Date(),
          },
        }
      );
      return true;
    } else {
      console.error(`${this.service.name} healthCheckAndUpdateClient failed`);
      await ServiceModel.updateOne(
        { _id: this.service._id },
        {
          $set: {
            healthy: false,
            lastHealthCheck: new Date(),
          },
        }
      );
      return false;
    }
  }

  private addDataForObject = (obj: any, data: any) => {
    if (!obj || typeof obj !== "object") return;
    for (const key in obj) {
      const value = obj[key];
      // Parse: @bull:file_service-queue:jobId.file.id
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
        console.log(`   🔄 Resolved ${value} -> ${dataKey} with key ${key}`);
      } else if (typeof value === "object") {
        this.addDataForObject(value, data);
      } else if (Array.isArray(value)) {
        value.forEach((item: any) => {
          this.addDataForObject(item, data);
        });
      }
    }
  };

  private async createQueueWorker(): Promise<any> {
    const worker = new Worker<ServiceJobData>(this.service.name, async (job: Job<ServiceJobData>) => {
      console.log(`${this.service.name} processing job ${job.id}`);
      console.log(`${this.service.name} job data:`, job.data);
      try {
        const children = await job.getChildrenValues();
        if (typeof job.data.params == "object") {
          this.addDataForObject(job.data.params, children);
        }
        let response: any;
        switch (job.data.method) {
          case "GET":
            const resultGet = await (this.client as AxiosInstance).get(job.data.params.path, job.data.params?.config || {});
            response = resultGet.data;
            break;
          case "POST":
            const resultPost = await (this.client as AxiosInstance).post(job.data.params.path, job.data.params.params, job.data.params?.config || {});
            response = resultPost.data;
            break
        }
        let results: any = {
          result: response,
        };
        if (job.data.params?.data) {
          results.data = job.data.params?.data;
        }

        console.log(`   ✅ Success:`, results);
        return results;
      } catch (error: any) {
        console.error(`${this.service.name} processing job ${job.id} failed:`, error.message);
        throw error;
      }
    }, {
      connection: redisConnection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3"),
    });
    this.worker = worker
    return worker;
  }

  private async eventWorker(): Promise<any> {
    this.worker?.on("completed", (job) => {
      console.log(`${this.service.name} job ${job?.id} completed`);
    });
    this.worker?.on("failed", (job, error) => {
      console.error(`${this.service.name} job ${job?.id} failed:`, error.message);
    });
  }

  public async createQueue(): Promise<any> {
    if (!this.client) {
      await this.createClient();
    }
    const check = await this.healthCheckAndUpdateClient();
    if (!check) {
      throw new Error(`${this.service.name} client not found`);
    }
    const options: DefaultJobOptions = this.service.options || {
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
    }
    this.queue = this.queue ? await this.deleteQueue() : undefined;
    this.queue = new Queue<ServiceJobData>(this.service.name, {
      connection: redisConnection,
      defaultJobOptions: options,
    });
    await this.createQueueWorker();
    await this.eventWorker();
    return this.queue;
  }

  public async healthCheckAndUpdateQueue(): Promise<boolean> {
    const check = await this.healthCheckAndUpdateClient();
    if (!check) {
      throw new Error(`${this.service.name} client not found`);
    }
    return true;
  }

  public async pingQueue(): Promise<boolean> {
    const client = this.queue?.client;
    return client?.then((client) => client.status === "ready") || false;
  }

  public async deleteQueue(): Promise<any> {
    this.queue?.close();
    this.queue = undefined;
    return this.queue;
  }

  public async getQueue(): Promise<any> {
    return await this.queue;
  }
  
  public async updateQueue(): Promise<any> {
    this.queue?.close();
    this.queue = await this.createQueue();
    return this.queue;
  }
}