import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import DatabaseConnection from "./database/connection";
import {
  MinioConfigModel,
  ServiceModel,
  WorkflowModel,
  IService,
} from "./database/models";
import { initBullBoard, serverAdapter } from "./ui/bull-board";
import {
  queueService,
  serviceQueueManager,
  serviceQueueEvents,
} from "./queue/queue";
import { MinioService } from "./queue/minio";
import { notificationService } from "./queue/notification";
import { initializeCronJobs, cleanupCronJobs } from "./queue/cronjob/cronjob-init";
import apiRoutes from "./api/routes";
import { authenticateBullMQ } from "./middleware/bullmq-auth.middleware";
import ExcelModel from "./database/models/excel.model";

const refreshBullBoardQueues = () => {
  initBullBoard(serviceQueueManager.getAllQueues());
};

serviceQueueEvents.on("queuesChanged", refreshBullBoardQueues);

// Load environment variables
dotenv.config();

/**
 * Main application entry point
 */
async function main() {
  try {
    console.log("🚀 Starting Plagiarism Checker Service...");
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

    // Connect to MongoDB
    await DatabaseConnection.connect();

    // Load tất cả enabled services từ database
    const allServices = await ServiceModel.find({ enabled: true });
    console.log(`\n📊 Found ${allServices.length} enabled service(s)`);
    

    await Promise.all(
      allServices.map(async (service) => {
        await serviceQueueManager.createServiceQueue(service as IService);
        const check =
          await serviceQueueManager.healthCheckAndUpdateServiceQueue(
            service as IService
          );
        if (!check) {
          console.warn(
            `⚠️ ${service.name} failed initial health check. Queue created but marked unhealthy`
          );
        }
      })
    );
    await serviceQueueManager.createServiceWorkflowQueue(WorkflowModel);
    await serviceQueueManager.createServiceExcelQueue(ExcelModel)
    serviceQueueManager.registerStaticQueue(
      "QUEUE",
      queueService,
      {
        concurrency: 2,
        attempts: 3,
      }
    );

    const MinioConfig = await MinioConfigModel.find();
    if (MinioConfig && MinioConfig.length > 0) {
      for (const config of MinioConfig) {
        const service = new MinioService(config);
        serviceQueueManager.registerStaticQueue(
          `MINIO_SERVICE_${config._id}`,
          service,
          {
            concurrency: 2,
            attempts: 3,
          }
        );
      }
    }

    // Đăng ký Notification Service
    serviceQueueManager.registerStaticQueue(
      "NOTIFICATION_SERVICE",
      notificationService,
      {
        concurrency: 3,
        attempts: 3,
      }
    );
    // Khởi tạo Bull Board UI với tất cả queues
    refreshBullBoardQueues();

    // Khởi tạo CronJobs (xóa old jobs, tạo lại từ database)
    await initializeCronJobs();

    // Create Express app with API routes
    const app = express();

    // CORS configuration
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "http://localhost:3002",
    ];

    app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }));

    // Body parser middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // API Routes
    app.use('/api', apiRoutes);

    // Bull Board UI - Protected with cookie-based authentication
    app.use('/bullmq', authenticateBullMQ, serverAdapter.getRouter());

    // Start server
    const port = parseInt(process.env.API_PORT || process.env.BULL_BOARD_PORT || "3000");
    app.listen(port, () => {
      console.log(`\n🎨 Bull Board UI: http://localhost:${port}/bullmq`);
      console.log(`\n🚀 API Server: http://localhost:${port}/api`);
    });
    // const WorkflowData = await WorkflowModel.findById("68f9d792133085ee4f6900b4") ;
    // if (WorkflowData) {
    //   await queueService.createJobWithChildren(WorkflowData.parentServiceName, WorkflowData.parentMethod, WorkflowData.parentParams, WorkflowData.children, WorkflowData.options);
    // }
    // Example: Thêm test job vào FILE_SERVICE queue
    // console.log("\n📝 Adding test job to FILE_SERVICE...");
    const { v4: uuidv4 } = require("uuid");

    // CronJobModel.watch().on("change", async (change) => {
    //   console.log("CronJob collection changed:", change);
    //   if (
    //     change.operationType === "insert" ||
    //     change.operationType === "update" ||
    //     change.operationType === "replace" ||
    //     change.operationType === "delete"
    //   ) {
    //     const cronJobId = change.documentKey._id;
    //     const cronJob = await CronJobModel.findById(cronJobId);
    //     if (cronJob && cronJob.enabled) {
    //       // type update replace => xóa cronjob củ, tạo cái mới
    //       // type insert => tạo mới
    //       // type delete => xóa cronjob
    //       if (
    //         change.operationType === "update" ||
    //         change.operationType === "replace"
    //       ) {
    //         if (cronJob.idJobCureent) {
    //           console.log(
    //             `Removing existing job with ID: ${cronJob.idJobCureent}`
    //           );
    //           await queueService.cancelJob("QUEUE", cronJob.idJobCureent);
    //           await CreateCronJob(cronJob);
    //         }
    //       } else if (change.operationType === "insert") {
    //         await CreateCronJob(cronJob);
    //       } else if (change.operationType === "delete") {
    //         if (cronJob.idJobCureent) {
    //           console.log(
    //             `Removing existing job with ID: ${cronJob.idJobCureent}`
    //           );
    //           await queueService.cancelJob("QUEUE", cronJob.idJobCureent);
    //         }
    //       }
    //     }
    //   }
    // });
   

    // cron.schedule("* * * * *", async () => {
    //   await queueService.createJobWithChildren(
    //   "QUEUE",
    //   "EnJob",
    //   {
    //     // Reference kết quả từ child job (custom syntax với @bull:)
    //     id: `@bull:${nameService}:${childJobId2}.file.id`,
    //     status: "APPROVED",
    //   },
    //   [
    //     {
    //       serviceName: "QUEUE",
    //       method: "evaluateJob",
    //       params: {
    //         code: `
    //             console.log("xxxxxxxxxxxxxxxxxxxxx", returnValue)
    //             await createJobWithChildren(returnValue.parentServiceName, returnValue.parentMethod, returnValue.parentParams, returnValue.children, returnValue.options);
    //             return "Successfully created child jobs for each file."
    //           `,
    //         returnValue: `@__id__0:`,
    //       },
    //       children: [
    //         {
    //           serviceName: "MONGODB_WORKFLOW",
    //           method: "findById",
    //           params: "68f9d792133085ee4f6900b4",
    //         },
    //       ],
    //     },
    //   ],
    //   {
    //     repeat: {
    //       pattern: "* * * * *", // Chạy mỗi phút
    //     },
    //   }
    // );
    // })

    console.log("\n✨ Application is running...");
    console.log(
      `   - ${serviceQueueManager.getAllQueues().length} service queue(s) active`
    );
    console.log(`   - Bull Board UI running on port ${port}`);
    console.log("\nPress Ctrl+C to exit\n");
  } catch (error) {
    console.error("❌ Failed to start application:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n\n🛑 Shutting down gracefully...");
  await cleanupCronJobs();
  await queueService.close();
  await serviceQueueManager.closeAll();
  await DatabaseConnection.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\n🛑 Shutting down gracefully...");
  await cleanupCronJobs();
  await queueService.close();
  await serviceQueueManager.closeAll();
  await DatabaseConnection.disconnect();
  process.exit(0);
});

// Start the application
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
