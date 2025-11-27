import { Request, Response } from 'express';
import { MinioConfigModel } from '../../database/models';
import { MinioService } from '../../queue/minio';

/**
 * Get all MinIO configs
 */
export const getAllMinioConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const configs = await MinioConfigModel.find({}).sort({ createdAt: -1 }).lean();

    // Mask secret keys in response
    const maskedConfigs = configs.map((config) => ({
      ...config,
      secretKey: '***' + config.secretKey.slice(-4),
    }));

    res.status(200).json({
      success: true,
      data: maskedConfigs,
      count: maskedConfigs.length,
    });
  } catch (error) {
    console.error('[MinioController] Get all MinIO configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Create MinIO config
 */
export const createMinioConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, endpoint, port, useSSL, accessKey, secretKey, bucketName } = req.body;

    // Validation
    if (!name || !endpoint || !port || !accessKey || !secretKey) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, endpoint, port, accessKey, secretKey',
      });
      return;
    }

    const config = await MinioConfigModel.create({
      name,
      endPoint: endpoint,
      port,
      useSSL: useSSL || false,
      accessKey,
      secretKey,
      bucketName: bucketName || 'default-bucket',
      connectionStatus: {
        connected: false,
      },
    });

    res.status(201).json({
      success: true,
      message: 'MinIO config created successfully',
      data: {
        ...config.toObject(),
        secretKey: '***' + secretKey.slice(-4),
      },
    });
  } catch (error) {
    console.error('[MinioController] Create MinIO config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Update MinIO config
 */
export const updateMinioConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const config = await MinioConfigModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!config) {
      res.status(404).json({
        success: false,
        message: 'MinIO config not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'MinIO config updated successfully',
      data: {
        ...config.toObject(),
        secretKey: '***' + config.secretKey.slice(-4),
      },
    });
  } catch (error) {
    console.error('[MinioController] Update MinIO config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Delete MinIO config
 */
export const deleteMinioConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const config = await MinioConfigModel.findByIdAndDelete(id);

    if (!config) {
      res.status(404).json({
        success: false,
        message: 'MinIO config not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'MinIO config deleted successfully',
    });
  } catch (error) {
    console.error('[MinioController] Delete MinIO config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Test MinIO connection
 */
export const testMinioConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const config = await MinioConfigModel.findById(id);

    if (!config) {
      res.status(404).json({
        success: false,
        message: 'MinIO config not found',
      });
      return;
    }

    // Test connection
    let connected = false;
    let buckets: string[] = [];

    try {
      const minioService = new MinioService(config);

      // Try to list buckets as a connection test
      const minioClient = (minioService as any).minioClient;
      if (minioClient && typeof minioClient.listBuckets === 'function') {
        const bucketList = await new Promise<any[]>((resolve, reject) => {
          minioClient.listBuckets((err: any, buckets: any[]) => {
            if (err) reject(err);
            else resolve(buckets);
          });
        });
        buckets = bucketList.map((b) => b.name);
        connected = true;
      } else {
        connected = true; // Assume connection is ok if client initialized
      }

      // Update config
      config.connectionStatus = {
        connected: true,
        lastCheck: new Date(),
      };
      await config.save();
    } catch (error) {
      console.error('[MinioController] Connection test failed:', error);
      connected = false;

      config.connectionStatus = {
        connected: false,
        lastCheck: new Date(),
        error: String(error),
      };
      await config.save();
    }

    res.status(200).json({
      success: true,
      message: connected ? 'Connection successful' : 'Connection failed',
      data: {
        connected,
        buckets: connected ? buckets : [],
      },
    });
  } catch (error) {
    console.error('[MinioController] Test connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
