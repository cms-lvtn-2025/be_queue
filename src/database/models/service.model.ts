import { DefaultJobOptions } from 'bullmq';
import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Service metadata interface
 */
export interface IServiceMetadata {
  timeout?: number;
  [key: string]: any;
}

/**
 * Service document interface
 */
export interface IService extends Document {
  name: string;
  url: string;
  port: number;
  protocol: 'grpc' | 'http' | 'https';
  protoPath?: string;
  protoPackage?: string;
  enabled: boolean;
  healthy: boolean;
  options?: DefaultJobOptions;
  metadata?: IServiceMetadata;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}


/**
 * Service Model interface for static methods
 */
export interface IServiceModel extends Model<IService> {
}

/**
 * Service Schema
 */
const ServiceSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
    },
    protocol: {
      type: String,
      required: true,
      enum: ['grpc', 'http', 'https'],
      lowercase: true,
    },
    protoPath: {
      type: String,
      required: false,
      trim: true,
    },
    protoPackage: {
      type: String,
      required: false,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    healthy: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastHealthCheck: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'services',
  }
);

/**
 * Service Model
 */
export const ServiceModel = mongoose.model<IService, IServiceModel>('Service', ServiceSchema);

export default ServiceModel;
