# Plagiarism Checker Service - API Setup Guide

## Overview

API backend được chuyển đổi từ SSR sang RESTful API để frontend riêng có thể sử dụng.

## Features

- ✅ JWT Authentication (12 giờ, no refresh token)
- ✅ Email/Password Login
- ✅ Google Authenticator 2FA
- ✅ Email OTP Alternative
- ✅ Role-based Access Control (Admin/User)
- ✅ Services Management API
- ✅ Workflows Management API
- ✅ Cron Jobs Management API
- ✅ MinIO Management API
- ✅ Queue Management API
- ✅ CORS Support

## Prerequisites

- Node.js 18+
- MongoDB with replica set
- Redis
- SMTP Server (Gmail recommended)

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
MONGODB_URI=mongodb://username:password@localhost:10000/thesis_db?replicaSet=rs0

# JWT Secret (IMPORTANT: Change this!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Configuration (for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=lyvinhthai321@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=lyvinhthai321@gmail.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Server Port
API_PORT=3000
```

### 3. Setup Gmail App Password

1. Go to Google Account Settings
2. Security → 2-Step Verification
3. App passwords → Generate new password
4. Copy password to `SMTP_PASS` in `.env`

### 4. Seed Admin User

Create initial admin user:

```bash
npm run seed:admin
```

This creates:
- **Email:** `lyvinhthai321@gmail.com`
- **Password:** `Admin@123`
- **Role:** `admin`

⚠️ **IMPORTANT:** Change password and setup 2FA after first login!

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## API Endpoints

Base URL: `http://localhost:3000/api`

### Authentication Flow

```
1. POST /api/auth/login
   → Returns tempToken

2a. POST /api/auth/setup-2fa (first time)
    → Returns QR code for Google Authenticator

2b. POST /api/auth/verify-2fa
    → Returns accessToken (12h)

   OR

2c. POST /api/auth/request-otp-email
    → Sends OTP to email

2d. POST /api/auth/verify-otp-email
    → Returns accessToken (12h)

3. Use accessToken in Authorization header
   Authorization: Bearer <accessToken>
```

### Available Endpoints

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

**Authentication:**
- `POST /api/auth/login` - Login
- `POST /api/auth/setup-2fa` - Setup 2FA
- `POST /api/auth/verify-2fa` - Verify 2FA
- `POST /api/auth/request-otp-email` - Request email OTP
- `POST /api/auth/verify-otp-email` - Verify email OTP
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/register` - Register new user (admin only)

**Services:**
- `GET /api/services` - List services
- `POST /api/services` - Create service
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `PATCH /api/services/:id/toggle` - Toggle enable/disable
- `POST /api/services/:id/health-check` - Manual health check

**Workflows:**
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `POST /api/workflows/:id/execute` - Execute workflow

**Cron Jobs:**
- `GET /api/cronjobs` - List cron jobs
- `POST /api/cronjobs` - Create cron job
- `PUT /api/cronjobs/:id` - Update cron job
- `PATCH /api/cronjobs/:id/toggle` - Toggle cron job
- `DELETE /api/cronjobs/:id` - Delete cron job

**MinIO:**
- `GET /api/minio` - List MinIO configs
- `POST /api/minio` - Create MinIO config
- `PUT /api/minio/:id` - Update config
- `DELETE /api/minio/:id` - Delete config
- `POST /api/minio/:id/test` - Test connection

**Queues:**
- `GET /api/queues` - List all queues
- `GET /api/queues/:name` - Get queue details
- `GET /api/queues/:name/jobs` - Get jobs in queue
- `POST /api/queues/:name/jobs` - Add job to queue
- `DELETE /api/queues/:name/jobs/:jobId` - Remove job
- `POST /api/queues/:name/jobs/:jobId/retry` - Retry failed job

## Testing with Postman

1. Import Postman collection from `API_DOCUMENTATION.md`
2. Set base URL: `http://localhost:3000/api`
3. Login to get token
4. Set token in Authorization header for protected routes

Example requests:

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lyvinhthai321@gmail.com",
    "password": "Admin@123"
  }'
```

### Setup 2FA
```bash
curl -X POST http://localhost:3000/api/auth/setup-2fa \
  -H "Authorization: Bearer <tempToken>"
```

### Verify 2FA
```bash
curl -X POST http://localhost:3000/api/auth/verify-2fa \
  -H "Authorization: Bearer <tempToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

### Get Services (with accessToken)
```bash
curl -X GET http://localhost:3000/api/services \
  -H "Authorization: Bearer <accessToken>"
```

## Security Best Practices

1. **Change JWT Secret**
   - Generate strong random secret
   - Never commit to git

2. **Enable 2FA**
   - All users should enable 2FA
   - Email `lyvinhthai321@gmail.com` is required to have 2FA

3. **HTTPS in Production**
   - Use HTTPS for all API calls
   - Update `FRONTEND_URL` to HTTPS

4. **Rate Limiting**
   - Login: 5 attempts per 15 minutes
   - OTP: 3 requests per 15 minutes

5. **Token Management**
   - Tokens expire after 12 hours
   - No refresh token (re-login required)
   - Store token securely on client

## Frontend Integration

### Setup Axios Client

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Login Flow

```typescript
// 1. Login
const loginResponse = await api.post('/auth/login', {
  email: 'lyvinhthai321@gmail.com',
  password: 'Admin@123',
});

const { tempToken, twoFactorEnabled } = loginResponse.data.data;
localStorage.setItem('tempToken', tempToken);

// 2a. If 2FA enabled
if (twoFactorEnabled) {
  // Show 2FA input
  const verifyResponse = await api.post(
    '/auth/verify-2fa',
    { token: '123456' },
    { headers: { Authorization: `Bearer ${tempToken}` } }
  );

  const { accessToken } = verifyResponse.data.data;
  localStorage.setItem('accessToken', accessToken);
  localStorage.removeItem('tempToken');
}

// 2b. Or use email OTP
else {
  await api.post(
    '/auth/request-otp-email',
    {},
    { headers: { Authorization: `Bearer ${tempToken}` } }
  );

  // User enters OTP from email
  const verifyResponse = await api.post(
    '/auth/verify-otp-email',
    { otp: '123456' },
    { headers: { Authorization: `Bearer ${tempToken}` } }
  );

  const { accessToken } = verifyResponse.data.data;
  localStorage.setItem('accessToken', accessToken);
  localStorage.removeItem('tempToken');
}
```

## Troubleshooting

### CORS Errors

Update `FRONTEND_URL` in `.env`:
```env
FRONTEND_URL=http://localhost:5173
```

### Email OTP Not Sending

1. Check SMTP credentials
2. Enable "Less secure app access" for Gmail (or use App Password)
3. Check firewall/network settings

### JWT Token Invalid

1. Check `JWT_SECRET` matches across restarts
2. Token might be expired (12h limit)
3. Clear old tokens and re-login

### MongoDB Connection Failed

1. Check MongoDB is running
2. Verify replica set is initialized
3. Check connection string in `MONGODB_URI`

## Project Structure

```
src/
├── api/
│   ├── controllers/     # API controllers
│   │   ├── auth.controller.ts
│   │   ├── services.controller.ts
│   │   ├── workflows.controller.ts
│   │   ├── cronjobs.controller.ts
│   │   ├── minio.controller.ts
│   │   └── queues.controller.ts
│   └── routes/          # API routes
│       ├── index.ts
│       ├── auth.routes.ts
│       ├── services.routes.ts
│       ├── workflows.routes.ts
│       ├── cronjobs.routes.ts
│       ├── minio.routes.ts
│       └── queues.routes.ts
├── database/
│   ├── models/
│   │   ├── user.model.ts    # New user model
│   │   └── ...
│   └── seed-admin.ts        # Admin user seed
├── middleware/
│   └── auth.middleware.ts   # Authentication middleware
├── services/
│   └── email.service.ts     # Email service
├── utils/
│   ├── jwt.util.ts          # JWT utilities
│   ├── password.util.ts     # Password utilities
│   └── otp.util.ts          # OTP utilities
└── main.ts                  # Updated with API routes
```

## Additional Resources

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Postman Collection](./API_DOCUMENTATION.md#postman-collection) - Import for testing

## License

ISC

## Support

For issues or questions, contact the development team.
