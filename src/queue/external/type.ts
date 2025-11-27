import { Queue, Worker } from "bullmq";
import { IService } from "../../database";
import { ServiceJobData } from "../queue";


export interface ExternalClient {
  service: IService;
  client: any;
  queue: Queue<ServiceJobData, any, string> | undefined;
  worker: Worker<ServiceJobData, any, string> | undefined;
  
  ping(): Promise<boolean>;
  healthCheckAndUpdateClient(): Promise<boolean>;
  createClient(): any;
  updateClient(): any;
  deleteClient(): any;
  createQueue(): any;
  deleteQueue(): any;
  getQueue(): any;
  updateQueue(): any;
  healthCheckAndUpdateQueue(): Promise<boolean>;
  pingQueue(): Promise<boolean>;
}