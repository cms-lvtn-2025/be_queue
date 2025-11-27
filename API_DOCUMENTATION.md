# API Documentation - Plagiarism Checker Service

Base URL: `http://localhost:3000/api`

## Table of Contents
- [Authentication](#authentication)
- [Services Management](#services-management)
- [Workflows Management](#workflows-management)
- [Cron Jobs Management](#cron-jobs-management)
- [MinIO Management](#minio-management)
- [Queue Management](#queue-management)

---

## Authentication

### 1. Login - Step 1: Email & Password
**POST** `/api/auth/login`

Đăng nhập bằng email và password. Trả về temporary token để tiếp tục với 2FA hoặc OTP.

**Request Body:**
```json
{
  "email": "lyvinhthai321@gmail.com",
  "password": "yourpassword"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Login successful. Please verify with 2FA or request OTP.",
  "data": {
    "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userId": "507f1f77bcf86cd799439011",
    "email": "lyvinhthai321@gmail.com",
    "twoFactorEnabled": true,
    "requiresVerification": true
  }
}
```

**Response Error (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### 2. Setup Google Authenticator (2FA)
**POST** `/api/auth/setup-2fa`

Setup Google Authenticator cho user. Trả về QR code và secret.

**Headers:**
```
Authorization: Bearer <tempToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "2FA setup initiated",
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "manualEntryKey": "JBSWY3DPEHPK3PXP"
  }
}
```

**Instructions:**
1. Scan QR code bằng Google Authenticator app
2. Hoặc nhập manual key: `JBSWY3DPEHPK3PXP`
3. App sẽ generate 6-digit code
4. Use code để verify ở endpoint `/api/auth/verify-2fa`

---

### 3. Verify 2FA & Get Access Token
**POST** `/api/auth/verify-2fa`

Verify Google Authenticator code và nhận access token (valid 12 giờ).

**Headers:**
```
Authorization: Bearer <tempToken>
```

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "2FA verified successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "12h",
    "expiresAt": "2025-11-23T03:00:00.000Z",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "lyvinhthai321@gmail.com",
      "role": "admin"
    }
  }
}
```

**Response Error (401):**
```json
{
  "success": false,
  "message": "Invalid 2FA token"
}
```

---

### 4. Request Email OTP
**POST** `/api/auth/request-otp-email`

Gửi OTP code (6 digits) qua email. OTP valid trong 10 phút.

**Headers:**
```
Authorization: Bearer <tempToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "data": {
    "email": "lyvi***@gmail.com",
    "expiresIn": "10 minutes"
  }
}
```

**Email Content:**
```
Subject: Your OTP Code

Your OTP code is: 123456

This code will expire in 10 minutes.
Do not share this code with anyone.
```

---

### 5. Verify Email OTP & Get Access Token
**POST** `/api/auth/verify-otp-email`

Verify OTP từ email và nhận access token (valid 12 giờ).

**Headers:**
```
Authorization: Bearer <tempToken>
```

**Request Body:**
```json
{
  "otp": "123456"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "12h",
    "expiresAt": "2025-11-23T03:00:00.000Z",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "lyvinhthai321@gmail.com",
      "role": "admin"
    }
  }
}
```

**Response Error (401):**
```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

---

### 6. Get Current User Info
**GET** `/api/auth/me`

Lấy thông tin user hiện tại.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "lyvinhthai321@gmail.com",
    "role": "admin",
    "twoFactorEnabled": true,
    "lastLogin": "2025-11-22T15:00:00.000Z",
    "tokenExpiresAt": "2025-11-23T03:00:00.000Z"
  }
}
```

---

### 7. Logout
**POST** `/api/auth/logout`

Logout và invalidate access token.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 8. Register New User (Admin Only)
**POST** `/api/auth/register`

Tạo user mới. Chỉ admin mới được phép tạo user.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "email": "newuser@gmail.com",
  "password": "securepassword123",
  "role": "user"
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "email": "newuser@gmail.com",
    "role": "user",
    "twoFactorEnabled": false
  }
}
```

---

## Services Management

All service endpoints require authentication.

### 1. List All Services
**GET** `/api/services`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `enabled` (optional): `true` | `false` - Filter by enabled status
- `healthy` (optional): `true` | `false` - Filter by health status
- `protocol` (optional): `grpc` | `http` | `https` - Filter by protocol

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "FILE_SERVICE",
      "url": "localhost",
      "port": 50051,
      "protocol": "grpc",
      "protoPath": "/path/to/proto/file.proto",
      "protoPackage": "file",
      "enabled": true,
      "healthy": true,
      "lastHealthCheck": "2025-11-22T15:00:00.000Z",
      "createdAt": "2025-11-20T10:00:00.000Z",
      "updatedAt": "2025-11-22T15:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Get Service by ID
**GET** `/api/services/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "FILE_SERVICE",
    "url": "localhost",
    "port": 50051,
    "protocol": "grpc",
    "protoPath": "/path/to/proto/file.proto",
    "protoPackage": "file",
    "enabled": true,
    "healthy": true,
    "metadata": {
      "timeout": 5000
    },
    "lastHealthCheck": "2025-11-22T15:00:00.000Z",
    "createdAt": "2025-11-20T10:00:00.000Z",
    "updatedAt": "2025-11-22T15:00:00.000Z"
  }
}
```

---

### 3. Create Service
**POST** `/api/services`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "name": "NEW_SERVICE",
  "url": "localhost",
  "port": 50052,
  "protocol": "grpc",
  "protoPath": "/path/to/proto/service.proto",
  "protoPackage": "service",
  "enabled": true,
  "metadata": {
    "timeout": 5000
  }
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Service created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "NEW_SERVICE",
    "url": "localhost",
    "port": 50052,
    "protocol": "grpc",
    "enabled": true,
    "healthy": false
  }
}
```

---

### 4. Update Service
**PUT** `/api/services/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "url": "192.168.1.100",
  "port": 50053,
  "enabled": false
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Service updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "NEW_SERVICE",
    "url": "192.168.1.100",
    "port": 50053,
    "enabled": false
  }
}
```

---

### 5. Toggle Service Enable/Disable
**PATCH** `/api/services/:id/toggle`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Service toggled successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "enabled": true
  }
}
```

---

### 6. Delete Service
**DELETE** `/api/services/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Service deleted successfully"
}
```

---

### 7. Health Check Service
**POST** `/api/services/:id/health-check`

Manually trigger health check for a service.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Health check completed",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "healthy": true,
    "lastHealthCheck": "2025-11-22T15:30:00.000Z"
  }
}
```

---

## Workflows Management

### 1. List All Workflows
**GET** `/api/workflows`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "PLAGIARISM_CHECK_WORKFLOW",
      "queueName": "FILE_SERVICE",
      "data": {
        "inputFile": "document.pdf"
      },
      "children": [
        {
          "name": "PROCESS_RESULT",
          "queueName": "RESULT_SERVICE",
          "data": {}
        }
      ],
      "createdAt": "2025-11-20T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Get Workflow by ID
**GET** `/api/workflows/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "PLAGIARISM_CHECK_WORKFLOW",
    "queueName": "FILE_SERVICE",
    "data": {
      "inputFile": "document.pdf"
    },
    "children": [],
    "createdAt": "2025-11-20T10:00:00.000Z",
    "updatedAt": "2025-11-22T15:00:00.000Z"
  }
}
```

---

### 3. Create Workflow
**POST** `/api/workflows`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "name": "NEW_WORKFLOW",
  "queueName": "FILE_SERVICE",
  "data": {
    "inputFile": "test.pdf"
  },
  "children": [
    {
      "name": "CHILD_WORKFLOW",
      "queueName": "RESULT_SERVICE",
      "data": {}
    }
  ]
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Workflow created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "NEW_WORKFLOW",
    "queueName": "FILE_SERVICE"
  }
}
```

---

### 4. Update Workflow
**PUT** `/api/workflows/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "name": "UPDATED_WORKFLOW",
  "data": {
    "inputFile": "updated.pdf"
  }
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Workflow updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "UPDATED_WORKFLOW"
  }
}
```

---

### 5. Delete Workflow
**DELETE** `/api/workflows/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Workflow deleted successfully"
}
```

---

### 6. Execute Workflow
**POST** `/api/workflows/:id/execute`

Execute a workflow immediately.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body (optional):**
```json
{
  "data": {
    "overrideInputFile": "custom.pdf"
  }
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Workflow executed successfully",
  "data": {
    "jobId": "job-12345",
    "workflowId": "507f1f77bcf86cd799439012"
  }
}
```

---

## Cron Jobs Management

### 1. List All Cron Jobs
**GET** `/api/cronjobs`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `enabled` (optional): `true` | `false`

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Daily Backup",
      "cronExpression": "0 0 * * *",
      "WL_id": "507f1f77bcf86cd799439001",
      "enabled": true,
      "lastRun": "2025-11-22T00:00:00.000Z",
      "nextRun": "2025-11-23T00:00:00.000Z",
      "createdAt": "2025-11-20T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Create Cron Job
**POST** `/api/cronjobs`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "name": "Hourly Check",
  "cronExpression": "0 * * * *",
  "WL_id": "507f1f77bcf86cd799439001",
  "enabled": true
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Cron job created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Hourly Check",
    "cronExpression": "0 * * * *",
    "enabled": true
  }
}
```

---

### 3. Update Cron Job
**PUT** `/api/cronjobs/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "cronExpression": "0 */2 * * *",
  "enabled": false
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Cron job updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "cronExpression": "0 */2 * * *",
    "enabled": false
  }
}
```

---

### 4. Toggle Cron Job
**PATCH** `/api/cronjobs/:id/toggle`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Cron job toggled successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "enabled": true
  }
}
```

---

### 5. Delete Cron Job
**DELETE** `/api/cronjobs/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Cron job deleted successfully"
}
```

---

## MinIO Management

### 1. List All MinIO Configs
**GET** `/api/minio`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Primary MinIO",
      "endpoint": "127.0.0.1",
      "port": 10005,
      "useSSL": false,
      "accessKey": "thaily",
      "connected": true,
      "lastCheck": "2025-11-22T15:00:00.000Z",
      "createdAt": "2025-11-20T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Create MinIO Config
**POST** `/api/minio`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "name": "Backup MinIO",
  "endpoint": "192.168.1.100",
  "port": 9000,
  "useSSL": true,
  "accessKey": "admin",
  "secretKey": "secretpassword"
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "MinIO config created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Backup MinIO",
    "endpoint": "192.168.1.100",
    "port": 9000,
    "connected": false
  }
}
```

---

### 3. Update MinIO Config
**PUT** `/api/minio/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "endpoint": "192.168.1.101",
  "port": 9001
}
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "MinIO config updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "endpoint": "192.168.1.101",
    "port": 9001
  }
}
```

---

### 4. Delete MinIO Config
**DELETE** `/api/minio/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "MinIO config deleted successfully"
}
```

---

### 5. Test MinIO Connection
**POST** `/api/minio/:id/test`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Connection successful",
  "data": {
    "connected": true,
    "buckets": ["bucket1", "bucket2"]
  }
}
```

---

## Queue Management

### 1. List All Queues
**GET** `/api/queues`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "name": "FILE_SERVICE",
      "type": "dynamic",
      "jobCounts": {
        "active": 2,
        "waiting": 5,
        "completed": 100,
        "failed": 3
      }
    }
  ],
  "count": 1
}
```

---

### 2. Get Queue Details
**GET** `/api/queues/:name`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "name": "FILE_SERVICE",
    "type": "dynamic",
    "service": {
      "id": "507f1f77bcf86cd799439011",
      "name": "FILE_SERVICE",
      "enabled": true,
      "healthy": true
    },
    "jobCounts": {
      "active": 2,
      "waiting": 5,
      "completed": 100,
      "failed": 3,
      "delayed": 0
    }
  }
}
```

---

### 3. Get Jobs in Queue
**GET** `/api/queues/:name/jobs`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `status` (optional): `active` | `waiting` | `completed` | `failed` | `delayed`
- `limit` (optional): number, default 50
- `offset` (optional): number, default 0

**Response Success (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "job-12345",
      "name": "processFile",
      "data": {
        "fileId": "file-001"
      },
      "progress": 50,
      "returnvalue": null,
      "failedReason": null,
      "timestamp": 1700000000000,
      "processedOn": 1700000100000,
      "finishedOn": null
    }
  ],
  "count": 1,
  "total": 5
}
```

---

### 4. Add Job to Queue
**POST** `/api/queues/:name/jobs`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "name": "processFile",
  "data": {
    "fileId": "file-001",
    "action": "check"
  },
  "opts": {
    "priority": 1,
    "delay": 0,
    "attempts": 3
  }
}
```

**Response Success (201):**
```json
{
  "success": true,
  "message": "Job added to queue successfully",
  "data": {
    "jobId": "job-12346",
    "queueName": "FILE_SERVICE"
  }
}
```

---

### 5. Get Job Status
**GET** `/api/queues/:name/jobs/:jobId`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "id": "job-12345",
    "name": "processFile",
    "data": {
      "fileId": "file-001"
    },
    "progress": 100,
    "returnvalue": {
      "status": "completed",
      "result": "File processed successfully"
    },
    "state": "completed",
    "timestamp": 1700000000000,
    "processedOn": 1700000100000,
    "finishedOn": 1700000200000
  }
}
```

---

### 6. Remove Job
**DELETE** `/api/queues/:name/jobs/:jobId`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Job removed successfully"
}
```

---

### 7. Retry Failed Job
**POST** `/api/queues/:name/jobs/:jobId/retry`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Job retried successfully",
  "data": {
    "jobId": "job-12345",
    "state": "waiting"
  }
}
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized. Please login."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Forbidden. Insufficient permissions."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details"
}
```

---

## Authentication Flow Diagram

```
┌─────────────────┐
│  1. POST /login │
│  email+password │
└────────┬────────┘
         │
         ▼
   ┌─────────────┐
   │ Get tempToken│
   └────┬────┬───┘
        │    │
   ┌────▼─   └──────┐
   │ 2FA Enabled?    │
   └─────┬─────┬─────┘
         │     │
    YES  │     │ NO
         │     │
    ┌────▼──┐  ▼
    │Google │  Email OTP
    │Auth   │
    └───┬───┘
        │
        ▼
┌─────────────────────┐
│3. POST /verify-2fa  │
│   or /verify-otp    │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ accessToken  │
    │ (12h valid)  │
    └──────────────┘
```

---

## Environment Variables Required

Add to `.env` file:

```bash
# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=12h

# Email Configuration (for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=lyvinhthai321@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=lyvinhthai321@gmail.com

# CORS (Frontend URL)
FRONTEND_URL=http://localhost:5173

# Server
API_PORT=3000
```

---

## Rate Limiting

All authentication endpoints are rate limited:
- Login: 5 requests per 15 minutes per IP
- OTP Request: 3 requests per 15 minutes per user
- 2FA Verify: 5 attempts per 15 minutes per user

---

## Notes

1. **No Refresh Tokens**: System không sử dụng refresh token. Access token valid 12 giờ.
2. **Single Session**: Mỗi lần login tạo token mới. Token cũ vẫn valid cho đến khi hết hạn.
3. **2FA Required**: Email `lyvinhthai321@gmail.com` bắt buộc phải setup 2FA.
4. **Password Requirements**: Minimum 8 characters.
5. **OTP Expiry**: Email OTP expires sau 10 phút.
6. **Token Storage**: Frontend nên lưu token trong localStorage hoặc sessionStorage.
7. **CORS**: Backend sẽ accept requests từ `FRONTEND_URL` trong `.env`.

---

## Postman Collection

Import this into Postman for testing:

```json
{
  "info": {
    "name": "Plagiarism Checker API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"lyvinhthai321@gmail.com\",\n  \"password\": \"yourpassword\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["api", "auth", "login"]
            }
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "type": "string"
    }
  ]
}
```
