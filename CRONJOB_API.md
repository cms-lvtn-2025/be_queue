# CronJob API Documentation

API để quản lý CronJobs cho Workflows trong hệ thống plagiarism checker.

## Base URL
```
http://localhost:3000/admin/api/cronjobs
```

---

## Endpoints

### 1. Lấy tất cả CronJobs

**GET** `/admin/api/cronjobs`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "68faff70c9145d0c14f32aff",
      "WL_id": "68f9d792133085ee4f6900b4",
      "schedule": "* * * * *",
      "enabled": true,
      "idJobCureent": "aa22c0ad-5484-4967-93ee-b2547be956ca",
      "createdAt": "2025-10-24T05:00:00.000Z",
      "updatedAt": "2025-10-24T05:01:18.938Z"
    }
  ],
  "count": 1
}
```

---

### 2. Lấy CronJobs kèm thông tin Workflow

**GET** `/admin/api/cronjobs/with-workflow`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "68faff70c9145d0c14f32aff",
      "WL_id": "68f9d792133085ee4f6900b4",
      "schedule": "* * * * *",
      "enabled": true,
      "idJobCureent": "aa22c0ad-5484-4967-93ee-b2547be956ca",
      "workflow": {
        "_id": "68f9d792133085ee4f6900b4",
        "parentServiceName": "QUEUE",
        "parentMethod": "EnJob",
        "parentParams": {...},
        "children": [...]
      }
    }
  ],
  "count": 1
}
```

---

### 3. Lấy CronJob theo Workflow ID

**GET** `/admin/api/cronjobs/workflow/:workflowId`

**Parameters:**
- `workflowId` (path) - ID của workflow

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "68faff70c9145d0c14f32aff",
    "WL_id": "68f9d792133085ee4f6900b4",
    "schedule": "* * * * *",
    "enabled": true,
    "idJobCureent": "aa22c0ad-5484-4967-93ee-b2547be956ca"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "CronJob not found for this workflow"
}
```

---

### 4. Tạo CronJob mới

**POST** `/admin/api/cronjobs`

**Body:**
```json
{
  "workflowId": "68f9d792133085ee4f6900b4",
  "schedule": "*/5 * * * *",
  "enabled": true
}
```

**Fields:**
- `workflowId` (required) - ID của workflow
- `schedule` (required) - Cron expression (e.g., "* * * * *")
- `enabled` (optional, default: true) - Enable/disable cron job

**Cron Expression Examples:**
```
* * * * *        - Mỗi phút
*/5 * * * *      - Mỗi 5 phút
0 * * * *        - Mỗi giờ
0 9 * * *        - 9h sáng mỗi ngày
0 9 * * 1-5      - 9h sáng thứ 2-6
0 0 1 * *        - 0h ngày 1 mỗi tháng
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "68faff70c9145d0c14f32aff",
    "WL_id": "68f9d792133085ee4f6900b4",
    "schedule": "*/5 * * * *",
    "enabled": true,
    "idJobCureent": "new-job-uuid"
  },
  "message": "CronJob created successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "CronJob already exists for workflow 68f9d792133085ee4f6900b4. Use update instead."
}
```

---

### 5. Cập nhật CronJob

**PUT** `/admin/api/cronjobs/:id`

**Parameters:**
- `id` (path) - ID của cron job

**Body:**
```json
{
  "schedule": "0 9 * * *",
  "enabled": true
}
```

**Fields:**
- `schedule` (optional) - Cron expression mới
- `enabled` (optional) - Enable/disable

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "68faff70c9145d0c14f32aff",
    "WL_id": "68f9d792133085ee4f6900b4",
    "schedule": "0 9 * * *",
    "enabled": true,
    "idJobCureent": "new-job-uuid"
  },
  "message": "CronJob updated successfully"
}
```

**Note:** Update sẽ xóa job cũ và tạo job mới trong BullMQ.

---

### 6. Xóa CronJob

**DELETE** `/admin/api/cronjobs/:id`

**Parameters:**
- `id` (path) - ID của cron job

**Response:**
```json
{
  "success": true,
  "message": "CronJob deleted successfully"
}
```

---

### 7. Enable/Disable CronJob

**PATCH** `/admin/api/cronjobs/:id/toggle`

**Parameters:**
- `id` (path) - ID của cron job

**Body:**
```json
{
  "enabled": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "68faff70c9145d0c14f32aff",
    "enabled": false
  },
  "message": "CronJob disabled successfully"
}
```

---

## Workflow với UI

### 1. **List Workflows** - Hiển thị workflows với cron job status

```javascript
// Frontend call
const workflows = await fetch('/api/workflows').then(r => r.json());

// Cho mỗi workflow, check xem có cron job không
for (const workflow of workflows.data) {
  const cronJob = await fetch(`/admin/api/cronjobs/workflow/${workflow._id}`)
    .then(r => r.json())
    .catch(() => null);

  workflow.hasCronJob = !!cronJob?.data;
  workflow.cronJob = cronJob?.data;
}
```

### 2. **Tạo CronJob** - Nút "Create CronJob" trong workflow detail

```javascript
async function createCronJob(workflowId, schedule) {
  const response = await fetch('/admin/api/cronjobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowId,
      schedule,
      enabled: true
    })
  });

  const result = await response.json();
  if (!result.success) {
    alert(result.error);
  }
  return result;
}
```

### 3. **Sửa CronJob** - Modal edit cron schedule

```javascript
async function updateCronJob(cronJobId, newSchedule) {
  const response = await fetch(`/admin/api/cronjobs/${cronJobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schedule: newSchedule
    })
  });

  return await response.json();
}
```

### 4. **Xóa CronJob** - Nút "Delete CronJob"

```javascript
async function deleteCronJob(cronJobId) {
  const response = await fetch(`/admin/api/cronjobs/${cronJobId}`, {
    method: 'DELETE'
  });

  return await response.json();
}
```

---

## UI Design Suggestion

### Workflow List View
```
┌─────────────────────────────────────────────────────────┐
│ Workflow: Check Plagiarism                             │
│ ID: 68f9d792133085ee4f6900b4                           │
│                                                         │
│ CronJob: ✅ Active - Runs every 5 minutes (*/5 * * * *)│
│ [Edit CronJob] [Delete CronJob]                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Workflow: Generate Reports                             │
│ ID: 68f9d792133085ee4f6900b5                           │
│                                                         │
│ CronJob: ❌ No CronJob                                  │
│ [Create CronJob]                                        │
└─────────────────────────────────────────────────────────┘
```

### Edit CronJob Modal
```
┌─────────────────────────────────────┐
│ Edit CronJob                        │
├─────────────────────────────────────┤
│ Schedule (Cron Expression):         │
│ [*/5 * * * *]                       │
│                                     │
│ Common patterns:                    │
│ ○ Every minute    (* * * * *)      │
│ ○ Every 5 minutes (*/5 * * * *)    │
│ ○ Every hour      (0 * * * *)      │
│ ○ Daily at 9am    (0 9 * * *)      │
│ ● Custom          [*/5 * * * *]    │
│                                     │
│ Enabled: [x]                        │
│                                     │
│ [Cancel]  [Save]                    │
└─────────────────────────────────────┘
```

---

## Error Handling

Tất cả errors trả về format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

Common errors:
- `400` - Bad request (missing fields, validation error)
- `404` - Not found (workflow or cronjob không tồn tại)
- `500` - Server error

---

## Notes

1. **Unique constraint**: Mỗi workflow chỉ có thể có 1 cron job
2. **Update behavior**: Update sẽ xóa repeatable job cũ và tạo mới
3. **Delete behavior**: Xóa cron job sẽ xóa cả trong BullMQ queue
4. **Job ID tracking**: `idJobCureent` lưu UUID của repeatable job trong BullMQ
