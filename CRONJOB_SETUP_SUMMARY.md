# CronJob System - Setup Summary

## ✅ Hoàn thành

Đã tích hợp hoàn chỉnh hệ thống quản lý CronJob cho Workflows vào trong UI admin.

---

## 📁 Cấu trúc file

```
src/
├── database/models/
│   ├── cronjob.model.ts          ✅ Model CronJob (đã có sẵn)
│   └── index.ts                  ✅ Export CronJobModel
│
├── queue/
│   └── cronjob-service.ts        ✅ Service xử lý logic CronJob
│
└── ui/
    └── admin-routes.ts            ✅ Chứa tất cả routes (SSR + API)
```

---

## 🔗 API Endpoints

Tất cả CronJob API routes được gộp vào `/admin/api/cronjobs`:

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/admin/api/cronjobs` | Lấy tất cả cron jobs |
| GET | `/admin/api/cronjobs/with-workflow` | Lấy cron jobs kèm workflow info |
| GET | `/admin/api/cronjobs/workflow/:id` | Lấy cron job theo workflow ID |
| POST | `/admin/api/cronjobs` | Tạo cron job mới |
| PUT | `/admin/api/cronjobs/:id` | Cập nhật cron job |
| DELETE | `/admin/api/cronjobs/:id` | Xóa cron job |
| PATCH | `/admin/api/cronjobs/:id/toggle` | Enable/disable cron job |

---

## 🎯 Cách UI sử dụng

### 1. Check workflow có CronJob không

```javascript
// Trong workflow list page
const cronJob = await fetch(`/admin/api/cronjobs/workflow/${workflowId}`)
  .then(r => r.json())
  .catch(() => null);

const hasCronJob = !!cronJob?.data;
```

### 2. Tạo CronJob

```javascript
await fetch('/admin/api/cronjobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: '68f9d792133085ee4f6900b4',
    schedule: '*/5 * * * *',  // Mỗi 5 phút
    enabled: true
  })
});
```

### 3. Sửa CronJob

```javascript
await fetch(`/admin/api/cronjobs/${cronJobId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    schedule: '0 9 * * *'  // 9h sáng mỗi ngày
  })
});
```

### 4. Xóa CronJob

```javascript
await fetch(`/admin/api/cronjobs/${cronJobId}`, {
  method: 'DELETE'
});
```

---

## 📋 Cron Expression Examples

```
* * * * *        - Mỗi phút
*/5 * * * *      - Mỗi 5 phút
0 * * * *        - Mỗi giờ
0 9 * * *        - 9h sáng mỗi ngày
0 9 * * 1-5      - 9h sáng thứ 2-6
0 0 1 * *        - 0h ngày 1 mỗi tháng
```

---

## 🧪 Test API

```bash
# Tạo cron job
curl -X POST http://localhost:3000/admin/api/cronjobs \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "68f9d792133085ee4f6900b4",
    "schedule": "* * * * *",
    "enabled": true
  }'

# Lấy cron job của workflow
curl http://localhost:3000/admin/api/cronjobs/workflow/68f9d792133085ee4f6900b4

# Lấy tất cả cron jobs
curl http://localhost:3000/admin/api/cronjobs

# Update schedule
curl -X PUT http://localhost:3000/admin/api/cronjobs/68faff70c9145d0c14f32aff \
  -H "Content-Type: application/json" \
  -d '{"schedule": "*/5 * * * *"}'

# Delete cron job
curl -X DELETE http://localhost:3000/admin/api/cronjobs/68faff70c9145d0c14f32aff
```

---

## 💡 UI Implementation Suggestions

### Workflow List Page

Thêm cột "CronJob Status":

```
| Workflow Name | Service | Method | CronJob | Actions |
|---------------|---------|--------|---------|---------|
| Check Plagiarism | QUEUE | EnJob | ✅ */5 * * * * | [Edit] [Delete] |
| Generate Report  | FILE  | generatePDF | ❌ No CronJob | [Create CronJob] |
```

### Workflow Detail Page

Thêm section CronJob:

```
┌─────────────────────────────────────────┐
│ CronJob Configuration                   │
├─────────────────────────────────────────┤
│ Status: ✅ Active                        │
│ Schedule: */5 * * * * (Every 5 minutes) │
│ Last Run: 2025-01-20 10:25:00          │
│ Next Run: 2025-01-20 10:30:00          │
│                                         │
│ [Edit Schedule] [Disable] [Delete]     │
└─────────────────────────────────────────┘
```

### CronJob Editor Modal

```javascript
// Component pseudo-code
<Modal title="Edit CronJob">
  <Select onChange={handleScheduleChange}>
    <option value="* * * * *">Every minute</option>
    <option value="*/5 * * * *">Every 5 minutes</option>
    <option value="0 * * * *">Every hour</option>
    <option value="0 9 * * *">Daily at 9am</option>
    <option value="custom">Custom</option>
  </Select>

  {isCustom && (
    <Input
      placeholder="* * * * *"
      value={cronExpression}
      onChange={handleCronChange}
    />
  )}

  <Toggle
    label="Enabled"
    checked={enabled}
    onChange={handleToggle}
  />

  <Button onClick={handleSave}>Save</Button>
  <Button onClick={handleCancel}>Cancel</Button>
</Modal>
```

---

## 🔥 Important Notes

1. **Unique Constraint**: Mỗi workflow chỉ có thể có 1 cron job
2. **Update Behavior**: Update sẽ xóa repeatable job cũ và tạo mới trong BullMQ
3. **Delete Behavior**: Xóa cron job sẽ xóa cả trong BullMQ queue
4. **Job Tracking**: `idJobCureent` lưu UUID của repeatable job trong BullMQ
5. **Validation**: Cron expression được validate trong model

---

## 📖 Documentation

Chi tiết đầy đủ xem file: [CRONJOB_API.md](./CRONJOB_API.md)

---

## ✅ Checklist cho UI Developer

- [ ] Thêm cột "CronJob" trong workflow list
- [ ] Hiển thị badge status (Active/Inactive) cho mỗi workflow
- [ ] Nút "Create CronJob" cho workflows chưa có cron
- [ ] Modal "Edit CronJob" với dropdown chọn schedule
- [ ] Nút "Delete CronJob" với confirmation
- [ ] Toggle enable/disable cron job
- [ ] Hiển thị Last Run / Next Run (optional - cần thêm logic)
- [ ] Form validation cho cron expression
- [ ] Error handling và toast notifications
- [ ] Refresh workflow list sau khi CRUD cron job

---

## 🚀 Ready to Use!

Tất cả backend đã sẵn sàng. UI chỉ cần gọi API và render!
