import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * File Upload Type enum - matches Go backend types
 */
export enum FileUploadType {
  GRADE_SUPERVISOR = 'grade_supervisor',
  GRADE_DEFENCE = 'grade_defence',
  TOPIC_FOR_DEPARTMENT = 'topic_for_department',
  COUNCIL_FOR_DEPARTMENT = 'council_for_department',
  COUNCIL_FOR_AFFAIR = 'council_for_affair',
  STUDENT_FOR_AFFAIR = 'student_for_affair',
  TEACHER_FOR_AFFAIR = 'teacher_for_affair',
  MIDTERM = 'midterm',
  FINAL = 'final',
}

/**
 * Excel Status enum
 */
export enum ExcelStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Excel document interface
 */
export interface IExcel extends Document {
  file: string;
  title: string;
  option: string;
  tableType: number;
  sum: number;
  current: number;
  tableId: string;
  status: ExcelStatus;
  messages: string[];
  uploadType: FileUploadType;
  percentage: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Excel Model interface for static methods
 */
export interface IExcelModel extends Model<IExcel> {}

/**
 * Excel Schema
 */
const ExcelSchema: Schema = new Schema(
  {
    file: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    sum: {
      type: Number,
      required: false,
      default: 0,
    },
    current: {
      type: Number,
      required: false,
      default: 0,
    },
    option: {
      type: String,
      required: true,
      default: 'excel',
    },
    tableType: {
      type: Number,
      required: true,
      alias: 'table_type',
    },
    tableId: {
      type: String,
      required: true,
      alias: 'table_id',
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ExcelStatus),
      default: ExcelStatus.PENDING,
    },
    messages: {
      type: Array,
      default: [],
    },
    uploadType: {
      type: String,
      required: true,
      enum: Object.values(FileUploadType),
      alias: 'upload_type',
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    createdBy: {
      type: String,
      required: true,
      alias: 'created_by',
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'Excel',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Indexes for performance
 */
ExcelSchema.index({ uploadType: 1 });
ExcelSchema.index({ status: 1 });
ExcelSchema.index({ createdBy: 1 });
ExcelSchema.index({ createdAt: -1 });

/**
 * Excel Model
 */
export const ExcelModel = mongoose.model<IExcel, IExcelModel>('Excel', ExcelSchema);

export default ExcelModel;
