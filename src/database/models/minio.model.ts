import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * MinIO configuration interface
 */
export interface IMinioConfig extends Document {
  name: string;
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  enabled: boolean;
  region?: string;
  connectionStatus?: {
    connected: boolean;
    lastCheck?: Date;
    error?: string;
  };
  metadata?: {
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MinIO Model interface for static methods
 */
export interface IMinioConfigModel extends Model<IMinioConfig> {
  getActiveConfig(): Promise<IMinioConfig | null>;
}

/**
 * MinIO Config Schema
 */
const MinioConfigSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
      default: 'MINIO',
    },
    endPoint: {
      type: String,
      required: true,
      trim: true,
    },
    port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
      default: 9000,
    },
    useSSL: {
      type: Boolean,
      default: false,
    },
    accessKey: {
      type: String,
      required: true,
      trim: true,
    },
    secretKey: {
      type: String,
      required: true,
      trim: true,
    },
    bucketName: {
      type: String,
      required: true,
      trim: true,
      default: 'plagiarism-reports',
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    region: {
      type: String,
      default: 'us-east-1',
      trim: true,
    },
    connectionStatus: {
      connected: {
        type: Boolean,
        default: false,
      },
      lastCheck: {
        type: Date,
      },
      error: {
        type: String,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'minio',
  }
);

/**
 * Static method: Get active MinIO config
 */
MinioConfigSchema.statics.getActiveConfig = async function (): Promise<IMinioConfig | null> {
  return this.findOne({ enabled: true }).sort({ createdAt: -1 }).exec();
};

/**
 * MinIO Config Model
 */
export const MinioConfigModel = mongoose.model<IMinioConfig, IMinioConfigModel>(
  'MinioConfig',
  MinioConfigSchema
);

export default MinioConfigModel;
