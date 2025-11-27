import mongoose, { Schema, Document, Model } from 'mongoose';
import { JobsOptions } from 'bullmq';

/**
 * Children job interface (đệ quy)
 */
export interface IWorkflowChildren {
  serviceName: string;
  method: string;
  params: any;
  options?: JobsOptions;
  children: IWorkflowChildren[];
}

/**
 * Flow options interface (từ BullMQ FlowOpts)
 */
export interface IFlowOpts {
  [key: string]: any;
}

/**
 * Workflow document interface
 */
export interface IWorkflow extends Document {
  id?: string;
  name: string;
  parentServiceName: string;
  parentMethod: string;
  parentParams: any;
  children: IWorkflowChildren[];
  options?: JobsOptions;
  flowOpts?: IFlowOpts;
}

/**
 * Workflow Model interface for static methods
 */
export interface IWorkflowModel extends Model<IWorkflow> {}

/**
 * Nested Children Schema (đệ quy)
 */
const WorkflowChildrenSchema: Schema = new Schema(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      required: true,
      trim: true,
    },
    params: {
      type: Schema.Types.Mixed,
      required: true,
    },
    options: {
      type: Schema.Types.Mixed,
      required: false,
    },
    children: {
      type: [Schema.Types.Mixed], // Đệ quy cho nested children
      required: false,
    },
  },
);

/**
 * Workflow Schema
 */
const WorkflowSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    parentServiceName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    parentMethod: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    parentParams: {
      type: Schema.Types.Mixed,
      required: true,
    },
    children: {
      type: [WorkflowChildrenSchema],
      required: true,
      default: [],
    },
    options: {
      type: Schema.Types.Mixed,
      required: false,
    },
    flowOpts: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'workflows',
  }
);

/**
 * Indexes
 */
/**
 * Workflow Model
 */
export const WorkflowModel = mongoose.model<IWorkflow, IWorkflowModel>(
  'Workflow',
  WorkflowSchema
);



export default WorkflowModel;
