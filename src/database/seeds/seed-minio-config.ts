/**
 * Script để seed MinIO configuration vào MongoDB
 *
 * Chạy: npx ts-node src/database/seeds/seed-minio-config.ts
 */

import mongoose from 'mongoose';
import { MinioConfigModel } from '../models/minio.model';

async function seedMinioConfig() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/plagiarism-checker';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check if config already exists
    const existingConfig = await MinioConfigModel.findOne({ name: 'MINIO' });

    if (existingConfig) {
      console.log('MinIO config already exists:');
      console.log({
        name: existingConfig.name,
        endPoint: existingConfig.endPoint,
        port: existingConfig.port,
        bucketName: existingConfig.bucketName,
        enabled: existingConfig.enabled,
      });

      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      readline.question('Do you want to update it? (yes/no): ', async (answer: string) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          await updateConfig(existingConfig._id);
        } else {
          console.log('Skipping update.');
        }
        readline.close();
        await mongoose.disconnect();
        process.exit(0);
      });
    } else {
      await createNewConfig();
      await mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    console.error('Error seeding MinIO config:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

async function createNewConfig() {
  const config = new MinioConfigModel({
    name: 'MINIO',
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucketName: process.env.MINIO_BUCKET_NAME || 'plagiarism-reports',
    enabled: true,
    region: 'us-east-1',
    metadata: {
      description: 'Default MinIO configuration',
      createdBy: 'seed-script',
    },
  });

  await config.save();
  console.log('MinIO config created successfully:');
  console.log({
    name: config.name,
    endPoint: config.endPoint,
    port: config.port,
    bucketName: config.bucketName,
    enabled: config.enabled,
  });
}

async function updateConfig(id: any) {
  await MinioConfigModel.findByIdAndUpdate(id, {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucketName: process.env.MINIO_BUCKET_NAME || 'plagiarism-reports',
    enabled: true,
  });

  console.log('MinIO config updated successfully');
}

// Run seed
seedMinioConfig();
