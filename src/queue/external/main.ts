import { IService } from "../../database";
import { GrpcService } from "./grpc/main";
import { ExternalService } from "./baseExternal";
import { Worker } from "bullmq";
import { ServiceJobData } from "../queue";
import { HttpService } from "./http/main";

const getServiceKey = (service: IService): string => {
  return (service._id ? service._id.toString() : service.name).toUpperCase();
};

export class ManagerExternalService {
  private externalServices: Map<string, ExternalService>;

  constructor() {
    this.externalServices = new Map();
  }

  private getExternalService(service: IService): ExternalService {
    const key = getServiceKey(service);
    const externalService = this.externalServices.get(key);
    if (!externalService) {
      throw new Error(`Service ${service.name} not found`);
    }
    externalService.service = service;
    return externalService;
  }

  public registerExternalService(service: IService): ExternalService {
    const key = getServiceKey(service);
    const existing = this.externalServices.get(key);
    if (existing) {
      existing.service = service;
      return existing;
    }

    let externalService: ExternalService;

    switch (service.protocol) {
      case "grpc":
        externalService = new GrpcService(service);
        break;
      case "http":
      case "https":
        externalService = new HttpService(service);
        break;
      default:
        throw new Error(`Unsupported service protocol: ${service.protocol}`);
    }

    this.externalServices.set(key, externalService);
    return externalService;
  }

  public connectService(service: IService): any {
    const externalService = this.getExternalService(service);
    return externalService.createClient();
  }

  public disconnectService(service: IService): any {
    const externalService = this.getExternalService(service);
    return externalService.deleteClient();
  }

  public healthCheckAndUpdateService(service: IService): Promise<boolean> {
    const externalService = this.getExternalService(service);
    return externalService.healthCheckAndUpdateClient();
  }

  public pingService(service: IService): Promise<boolean> {
    const externalService = this.getExternalService(service);
    return externalService.ping();
  }

  public getClient(service: IService): any {
    const externalService = this.getExternalService(service);
    return externalService.client;
  }

  public getWorker(service: IService): Worker<ServiceJobData, any, string> {
    const externalService = this.getExternalService(service);
    if (!externalService.worker) {
      throw new Error(`Worker for service ${service.name} is not initialized`);
    }
    return externalService.worker as Worker<ServiceJobData, any, string>;
  }

  public getAllClients(): any[] {
    return Array.from(this.externalServices.values()).map(
      (externalService) => externalService.client
    );
  }

  public getAllExternalServices(): ExternalService[] {
    return Array.from(this.externalServices.values());
  }

  public createQueue(service: IService): Promise<any> {
    const externalService = this.registerExternalService(service);
    return externalService.createQueue();
  }

  public async deleteQueue(service: IService): Promise<void> {
    const key = getServiceKey(service);
    const externalService = this.externalServices.get(key);
    if (!externalService) {
      return;
    }
    await externalService.deleteQueue();
  }

  public async unregisterService(service: IService): Promise<void> {
    const key = getServiceKey(service);
    if (!this.externalServices.has(key)) {
      return;
    }
    const externalService = this.externalServices.get(key);
    if (externalService) {
      try {
        await externalService.worker?.close();
      } catch (error) {
        console.warn(`Failed to close worker for ${service.name}:`, error);
      }
      try {
        await externalService.queue?.close();
      } catch (error) {
        console.warn(`Failed to close queue for ${service.name}:`, error);
      }
    }
    this.externalServices.delete(key);
  }
}