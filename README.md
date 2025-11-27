# Plagiarism Checker Service

Service quản lý queue động cho các gRPC services, tự động tạo queue và worker cho mỗi service từ database.

## Tính năng

- ✅ MongoDB với Mongoose ORM
- ✅ Dynamic Service Management từ database
- ✅ Auto-create Queue & Worker cho mỗi service
- ✅ gRPC Client tự động load từ proto files
- ✅ Bull Board UI để monitor queues
- ✅ BullMQ với Redis

## Cài đặt

```bash
yarn install
```

## Cấu hình

Copy `.env` và điều chỉnh các biến môi trường:

```env
MONGODB_URI=mongodb://thaily:password@localhost:10000/thesis_db
REDIS_HOST=localhost
REDIS_PORT=10002
BULL_BOARD_PORT=3000
GRPC_TLS_ENABLED=true
GRPC_CERT_PATH=../certs/clients/client.crt
GRPC_KEY_PATH=../certs/clients/client.key
GRPC_CA_PATH=../certs/ca/ca.crt
```

## Sử dụng

### 1. Seed services vào database

```bash
yarn seed:simple
```

### 2. Chạy service

```bash
yarn dev
```

Service sẽ:
- Kết nối MongoDB
- Load tất cả services (enabled & healthy)
- Tạo queue + worker + gRPC client cho mỗi service
- Start Bull Board UI tại `http://localhost:3000/admin/queues`

### 3. Thêm job vào queue

```typescript
import { serviceQueueManager } from './queue/grpc';

// Thêm job vào FILE_SERVICE queue
await serviceQueueManager.addJob('FILE_SERVICE', {
  method: 'UploadFile',  // gRPC method name
  params: {              // gRPC method params
    filename: 'test.pdf',
    content: Buffer.from('...')
  }
});
```

## Cấu trúc

```
src/
├── database/
│   ├── connection.ts          # MongoDB connection
│   ├── models/
│   │   └── service.model.ts   # Service schema
│   └── seed.ts                # Seed data
├── queue/
│   ├── grpc/
│   │   ├── client-loader.ts           # Load gRPC client động
│   │   ├── service-queue-manager.ts   # Quản lý queues động
│   │   └── index.ts
│   └── queue.ts               # (legacy)
├── ui/
│   └── bull-board.ts          # Bull Board UI
└── main.ts                    # Entry point
```

## Service Model

Mỗi service trong MongoDB có schema:

```typescript
{
  name: 'FILE_SERVICE',
  url: 'localhost',
  port: 50053,
  protocol: 'grpc',
  protoPath: '/path/to/file.proto',
  protoPackage: 'file.FileService',
  enabled: true,
  healthy: true,
  metadata: {
    timeout: 5000
  }
}
```

## API

### ServiceQueueManager

```typescript
// Tạo queue cho service
serviceQueueManager.createServiceQueue(service)

// Thêm job
serviceQueueManager.addJob(serviceName, { method, params })

// Lấy queue info
serviceQueueManager.getServiceQueue(serviceName)

// Lấy tất cả queues
serviceQueueManager.getAllQueues()

// Đóng tất cả
serviceQueueManager.closeAll()
```
