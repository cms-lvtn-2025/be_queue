import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * CronJob document interface
 */
export interface ICronJob extends Document {
  id?: string;
  WL_id: string; // Workflow ID reference
  schedule: string; // Cron expression (e.g., "* * * * *")
  idJobCureent?: string; // Optional: to track current job ID
  enabled?: boolean; // Optional: to enable/disable cronjob
  lastRun?: Date; // Optional: track last execution time
  nextRun?: Date; // Optional: track next scheduled time
}

/**
 * CronJob Model interface for static methods
 */
export interface ICronJobModel extends Model<ICronJob> {}

/**
 * CronJob Schema
 */
const CronJobSchema: Schema = new Schema(
  {
    WL_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
      ref: 'Workflow', // Reference to Workflow model
    },
    schedule: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v: string) {
          // Basic cron expression validation (5 or 6 fields)
          const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))( (\*|([0-9]{4})))?$/;
          return cronRegex.test(v);
        },
        message: props => `${props.value} is not a valid cron expression!`
      }
    },
    idJobCureent: {
      type: String,
      required: false,
      trim: true,
    },
    enabled: {
      type: Boolean,
      required: false,
      default: true,
    },
    lastRun: {
      type: Date,
      required: false,
    },
    nextRun: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'cronjob',
  }
);

/**
 * Indexes
 */
CronJobSchema.index({ WL_id: 1 });

/**
 * CronJob Model
 */
export const CronJobModel = mongoose.model<ICronJob, ICronJobModel>(
  'CronJob',
  CronJobSchema
);

export default CronJobModel;
