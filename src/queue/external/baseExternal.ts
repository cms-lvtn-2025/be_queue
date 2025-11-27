import { ExternalClient } from "./type";
import { IService } from "../../database";
import { Queue, Worker } from "bullmq";
import { ServiceJobData } from "../queue";

export abstract class ExternalService implements ExternalClient {
  public service: IService;
  public client: any;
  public queue: Queue<ServiceJobData, any, string> | undefined;
  public worker: Worker<ServiceJobData, any, string> | undefined;
  constructor(service: IService) {
    this.service = service;
    this.client = undefined;
    this.queue = undefined;
    this.worker = undefined;
  }

  abstract ping(): Promise<boolean>;
  abstract healthCheckAndUpdateClient(): Promise<boolean>;
  abstract createClient(): any;
  abstract updateClient(): any;
  abstract deleteClient(): any;
  abstract createQueue(): any;
  abstract deleteQueue(): any;
  abstract getQueue(): any;
  abstract updateQueue(): any;
  abstract healthCheckAndUpdateQueue(): Promise<boolean>;
  abstract pingQueue(): Promise<boolean>;

}