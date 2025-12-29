import { IService, ServiceModel } from "../../../database";
import { ExternalService } from "../baseExternal";
import path from "path";
import fs from "fs";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { DefaultJobOptions, Job, Queue, Worker } from "bullmq";
import { redisConnection, ServiceJobData, serviceQueueManager } from "../../queue";

interface GrpcSetting {
  address: string;
  serviceConstructor: any;
  credentials: grpc.ChannelCredentials;
}

export class GrpcService extends ExternalService {
  public name = "grpc";
  public version = "v.0.0.1";

  constructor(service: IService) {
    super(service);
    this.name = "grpc";
    this.version = "v.0.0.1";
  }
  private loadSetting(service: IService): GrpcSetting {
    try {
      if (!service.protoPath || !service.protoPackage) {
        throw new Error(
          `Service ${service.name} missing protoPath or protoPackage`
        );
      }
      // Resolve paths relative to src directory
      const srcDir = path.resolve(__dirname, "../../..");
      const protoBaseDir = path.resolve(srcDir, "proto");

      // Convert relative protoPath to absolute if needed
      let protoFilePath = service.protoPath;
      if (!path.isAbsolute(protoFilePath)) {
        protoFilePath = path.resolve(srcDir, protoFilePath);
      }

      const protoDir = path.dirname(protoFilePath);

      const packageDefinition = protoLoader.loadSync(protoFilePath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [protoDir, protoBaseDir, srcDir], // srcDir để resolve "proto/common/..."
      });
      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

      // Get service constructor từ package path động (e.g., "file.FileService")
      const packagePath = service.protoPackage.split(".");
      let ServiceConstructor: any = protoDescriptor;

      for (const part of packagePath) {
        ServiceConstructor = ServiceConstructor[part];
        if (!ServiceConstructor) {
          throw new Error(`Cannot find package: ${service.protoPackage}`);
        }
      }

      // Tạo credentials (check TLS từ env)
      let credentials: grpc.ChannelCredentials;
      const useTLS = process.env.GRPC_TLS_ENABLED === "true";

      if (useTLS) {
        try {
          const certPath = path.resolve(process.env.GRPC_CERT_PATH || "");
          const keyPath = path.resolve(process.env.GRPC_KEY_PATH || "");
          const caPath = path.resolve(process.env.GRPC_CA_PATH || "");

          const cert = fs.readFileSync(certPath);
          const key = fs.readFileSync(keyPath);
          const ca = fs.readFileSync(caPath);

          credentials = grpc.credentials.createSsl(ca, key, cert);
          console.log(`  🔒 TLS enabled`);
        } catch (error) {
          console.warn(`  ⚠️  TLS error, falling back to insecure`);
          credentials = grpc.credentials.createInsecure();
        }
      } else {
        credentials = grpc.credentials.createInsecure();
        console.log(`  🔓 Insecure connection`);
      }

      return {
        address: `${service.url}:${service.port}`,
        serviceConstructor: ServiceConstructor,
        credentials: credentials,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to load gRPC settings for service ${service.name}: ${error.message}`
      );
    }
  }
  private async waitForConnection(
    channel: grpc.Channel,
    timeoutMs: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;

      const checkState = () => {
        const state = channel.getConnectivityState(false);

        // READY = connected
        if (state === grpc.connectivityState.READY) {
          resolve(true);
          return;
        }

        // SHUTDOWN or TRANSIENT_FAILURE = failed
        if (
          state === grpc.connectivityState.SHUTDOWN ||
          state === grpc.connectivityState.TRANSIENT_FAILURE
        ) {
          if (Date.now() >= deadline) {
            resolve(false);
            return;
          }
        }

        // Continue waiting
        if (Date.now() < deadline) {
          channel.watchConnectivityState(state, deadline, (error) => {
            if (error) {
              resolve(false);
            } else {
              checkState();
            }
          });
        } else {
          resolve(false);
        }
      };

      checkState();
    });
  }
  public async createClient(): Promise<any> {
    try {
      const setting = this.loadSetting(this.service);
      this.client = new setting.serviceConstructor(
        setting.address,
        setting.credentials
      );
      return this.client;
    } catch (error: any) {
      console.error(`  ❌ ${this.service.name} createClient failed:`, error.message);
      throw error;
    }
  }
  public async updateClient(): Promise<any> {
    if (this.client) {
      this.client.close();
    }
    return this.createClient();
  }
  public async deleteClient(): Promise<any> {
    if (this.client) {
      this.client.close();
    }
  }
  public async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      const channel = this.client.getChannel();
      const state = channel.getConnectivityState(true); // true = try to connect
      const timeout = 5000;
      const connected = await this.waitForConnection(channel, timeout);
      return connected;
    } catch (error: any) {
      console.error(`  ❌ ${this.service.name} ping failed:`, error.message);
      return false;
    }
  }
  public async healthCheckAndUpdateClient(
  ): Promise<boolean> {
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
      console.log(`  ⚠️  ${this.service.name} unhealthy, recreating client...`);
      try {
        await this.updateClient();
        const recheck = await this.ping();
        await ServiceModel.updateOne(
          { _id: this.service._id },
          {
            $set: {
              healthy: recheck,
              lastHealthCheck: new Date(),
            },
          }
        );
        if (recheck) {
          console.log(`  ✅ ${this.service.name} client recreated and healthy`);
          return true;
        } else {
          console.log(`  ❌ ${this.service.name} still unhealthy after recreation`);
          return false;
        }
      } catch (error: any) {
        console.error(
          `  ❌ ${this.service.name} healthCheckAndUpdate failed:`,
          error.message
        );
        return false;
      }
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
    const check = await this.healthCheckAndUpdateClient();
    if (!check) {
      throw new Error(`${this.service.name} client not found`);
    }
    const worker = new Worker<ServiceJobData>(
      this.service.name,
      async (job: Job<ServiceJobData>) => {
        console.log(`\n⚡ [${this.service.name}] Processing job ${job.id}`);
        console.log(`   Method: ${job.data.method}`);
        console.log(`   Params:`, job.data.params);

        try {
          // Gọi gRPC method động
          const method = this.client[job.data.method];
          if (!method) {
            throw new Error(
              `Method ${job.data.method} not found on ${this.service.name}`
            );
          }
          const children = await job.getChildrenValues();
          if (typeof job.data.params == "object") {
            this.addDataForObject(job.data.params, children);
          }
          console.log("   📦 Children results:", children, job.data.params.params);

          // Call gRPC method
          const result = await new Promise((resolve, reject) => {
            method.call(
              this.client,
              job.data.params.params,
              (error: any, response: any) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(response);
                }
              }
            );
          });
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
          if (job.data.params?.options && job.data.params?.options?.FaildToMassage) {
            return {
              result: error.message,
              status: 400,
            }
          }
          else throw new Error(error.message);
        }
      },
      {
        connection: redisConnection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3"),
      }
    );
    this.worker = worker;
    return worker;
  }

  private async eventWorker(): Promise<any> {
    this.worker?.on("completed", async (job) => {
      console.log(`✨ [${this.service.name}] Job ${job.id} completed`);
      // Cập nhật progress của parent job nếu đây là child job
      await serviceQueueManager.updateParentProgress(job);
    });

    this.worker?.on("failed", (job, err) => {
      console.error(`❌ [${this.service.name}] Job ${job?.id} failed:`, err.message);
    });
  }

  public async createQueue(): Promise<any> {
    this.queue = this.queue ? await this.deleteQueue() : undefined
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
    this.queue = new Queue<ServiceJobData>(this.service.name, {
      connection: redisConnection,
      defaultJobOptions: options,
    });
    await this.createQueueWorker();
    await this.eventWorker();
    return this.queue;
  }
  public async deleteQueue(): Promise<any> {
    this.worker?.close();
    this.queue?.close();
    this.queue = undefined;
    return this.queue;
  }
  public async getQueue(): Promise<any> {
    return this.queue;
  }
  public async updateQueue(): Promise<any> {
    this.queue?.close();
    this.queue = await this.createQueue();
    return this.queue;
  }
  public async healthCheckAndUpdateQueue(): Promise<boolean> {
    const isHealthy = await this.pingQueue();
    if (isHealthy) {
      return true;
    } else {
      console.log(`  ⚠️  ${this.service.name} queue unhealthy, recreating queue...`);
      try {
        const newQueue = await this.updateQueue();
        const recheck = await this.pingQueue();
        if (recheck) {
          console.log(`  ✅ ${this.service.name} queue recreated and healthy`);
          return true;
        } else {
          console.log(`  ❌ ${this.service.name} still unhealthy after recreation`);
          return false;
        }
      } catch (error: any) {
        console.error(`  ❌ ${this.service.name} healthCheckAndUpdateQueue failed:`, error.message);
        return false;
      }
    }
  }
  public async pingQueue(): Promise<boolean> {
    const client = this.queue?.client;
    return client?.then((client) => client.status === "ready") || false;
  }
}
