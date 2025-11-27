# CronJob Initialization System

## Vấn đề

Khi restart server, BullMQ tạo repeatable job mới **NHƯNG KHÔNG XÓA** job cũ, dẫn đến:
- ❌ Có 2 (hoặc nhiều hơn) cron jobs cùng chạy cho 1 workflow
- ❌ Mỗi lần restart lại thêm 1 duplicate job
- ❌ Database có 1 record nhưng BullMQ có nhiều jobs

## Giải pháp

Mỗi khi server start:
1. **Xóa TẤT CẢ repeatable jobs cũ** trong BullMQ
2. **Đọc từ database** tất cả CronJobs enabled
3. **Tạo lại** repeatable jobs trong BullMQ với job ID mới
4. **Cập nhật** `idJobCureent` trong database

## Implementation

### 1. File: `src/queue/cronjob-init.ts`

```typescript
export async function initializeCronJobs(): Promise<void>
```

**Flow:**
```
Start Server
    ↓
Connect to QUEUE service
    ↓
Get all repeatable jobs from BullMQ
    ↓
Remove each old repeatable job
    ↓
Read enabled CronJobs from database
    ↓
For each CronJob:
    - Generate new UUID
    - Create repeatable job in BullMQ
    - Update idJobCureent in database
    ↓
Done ✅
```

### 2. Integration trong `main.ts`

```typescript
async function main() {
  // ... setup queues ...

  // Khởi tạo CronJobs (xóa old, tạo mới)
  await initializeCronJobs();

  // ... start server ...
}
```

### 3. Cleanup khi Shutdown

```typescript
process.on("SIGINT", async () => {
  await cleanupCronJobs();  // Xóa tất cả repeatable jobs
  // ... other cleanup ...
});
```

## Workflow Chi Tiết

### Startup Sequence

```
1. Server starts
   └─> Connect MongoDB
   └─> Create service queues
   └─> Initialize CronJobs
       └─> Get QUEUE service ✓
       └─> Get all repeatable jobs (old ones)
           Jobs found: 5 old jobs
       └─> Remove each old job
           ✓ Removed: aa22c0ad-5484-4967-93ee-b2547be956ca
           ✓ Removed: bb33d0bd-6595-5a78-a4ee-c3658cb067db
           ...
       └─> Query database for enabled CronJobs
           Found: 2 enabled CronJobs
       └─> Create new repeatable jobs
           ✓ Created: 12345678-abcd-efgh-ijkl-123456789012
           ✓ Created: 87654321-dcba-hgfe-lkji-210987654321
       └─> Update idJobCureent in database
   └─> Start Bull Board UI
```

### Database State

**Before Restart:**
```json
{
  "_id": "68faff70c9145d0c14f32aff",
  "WL_id": "68f9d792133085ee4f6900b4",
  "schedule": "* * * * *",
  "enabled": true,
  "idJobCureent": "aa22c0ad-5484-4967-93ee-b2547be956ca"  // Old job ID
}
```

**After Restart:**
```json
{
  "_id": "68faff70c9145d0c14f32aff",
  "WL_id": "68f9d792133085ee4f6900b4",
  "schedule": "* * * * *",
  "enabled": true,
  "idJobCureent": "12345678-abcd-efgh-ijkl-123456789012"  // New job ID ✅
}
```

## Benefits

✅ **Không có duplicate jobs** - Mỗi workflow chỉ có 1 cron job duy nhất
✅ **Consistent state** - Database sync với BullMQ
✅ **Clean restart** - Mỗi lần restart tạo lại jobs từ đầu
✅ **Track được job ID** - `idJobCureent` luôn đúng với job đang chạy

## Logs Example

```bash
🚀 Starting Plagiarism Checker Service...
Environment: development

📊 Found 5 enabled service(s)
🔧 Creating queues for 5 healthy service(s)...

🔄 Initializing CronJobs...
🗑️  Cleaning old repeatable jobs from BullMQ...
   ✓ Removed old job: aa22c0ad-5484-4967-93ee-b2547be956ca
   ✓ Removed old job: bb33d0bd-6595-5a78-a4ee-c3658cb067db
✅ Cleaned 2 old repeatable jobs

📋 Found 2 enabled CronJob(s) in database
   ✓ Recreated CronJob for workflow 68f9d792133085ee4f6900b4: * * * * * (12345678-abcd-efgh-ijkl-123456789012)
   ✓ Recreated CronJob for workflow 68f9d793133085ee4f6900b5: */5 * * * * (87654321-dcba-hgfe-lkji-210987654321)

✅ CronJobs initialized: 2 success, 0 errors

🎨 Bull Board UI: http://localhost:3000/admin/queues

✨ Application is running...
   - 5 service queue(s) active
   - Bull Board UI running on port 3000

Press Ctrl+C to exit
```

## Testing

### Test Scenario 1: Normal Restart

```bash
# Terminal 1: Start server
npm run dev

# Check logs - should see:
# ✅ Cleaned X old repeatable jobs
# ✅ CronJobs initialized: X success, 0 errors

# Terminal 2: Check BullMQ
curl http://localhost:3000/admin/api/cronjobs

# Should see correct idJobCureent for each workflow
```

### Test Scenario 2: Multiple Restarts

```bash
# Restart 3 times
npm run dev  # Stop with Ctrl+C
npm run dev  # Stop with Ctrl+C
npm run dev

# Check BullMQ repeatable jobs count
# Should always be equal to enabled CronJobs in DB
```

### Test Scenario 3: Database Check

```javascript
// Before restart
db.cronjob.find({ enabled: true })
// Note down idJobCureent values

// After restart
db.cronjob.find({ enabled: true })
// idJobCureent should be different (new UUIDs)
```

## Edge Cases

### 1. QUEUE service không tồn tại
```
⚠️  QUEUE service not found, skipping CronJob initialization
```
→ Skip initialization, không crash

### 2. Không có enabled CronJobs
```
ℹ️  No enabled CronJobs found in database
```
→ Log info, tiếp tục start

### 3. Failed to create job
```
❌ Failed to recreate CronJob for workflow XXX: Error message
```
→ Log error, tiếp tục với jobs khác

## Important Notes

1. **Chỉ tạo lại enabled jobs** - Jobs với `enabled: false` bị bỏ qua
2. **New UUID mỗi lần start** - Không reuse job ID cũ
3. **Atomic operation** - Xóa tất cả trước, rồi mới tạo mới
4. **Error handling** - Fail gracefully, không crash server
5. **Cleanup on shutdown** - Xóa repeatable jobs khi tắt server

## Monitoring

Check số lượng repeatable jobs trong BullMQ:

```bash
# Via Bull Board UI
http://localhost:3000/admin/queues
→ Click vào QUEUE queue
→ Tab "Repeatable"
→ Should match số CronJobs enabled trong database

# Via API
curl http://localhost:3000/admin/api/cronjobs | jq '.count'
# Compare với số repeatable jobs trong Bull Board
```

## Troubleshooting

### Problem: Duplicate jobs vẫn xảy ra

**Solution:**
1. Check logs xem có message "Cleaned X old repeatable jobs" không
2. Nếu không có → Check QUEUE service có được tạo không
3. Check database có CronJobs nào enabled: false không

### Problem: CronJobs không chạy sau restart

**Solution:**
1. Check logs: "CronJobs initialized: X success, Y errors"
2. Nếu có errors → Check error message
3. Check `enabled` field trong database
4. Check Bull Board UI → Repeatable jobs tab

### Problem: idJobCureent không update

**Solution:**
1. Check database write permissions
2. Check logs có error khi save không
3. Manually update: `db.cronjob.updateOne({_id: "..."}, {$set: {idJobCureent: "new-uuid"}})`

---

## Summary

Hệ thống tự động:
- ✅ Xóa old repeatable jobs khi start
- ✅ Tạo lại jobs từ database
- ✅ Update job IDs mới
- ✅ Cleanup khi shutdown

Không cần manual intervention! 🚀
