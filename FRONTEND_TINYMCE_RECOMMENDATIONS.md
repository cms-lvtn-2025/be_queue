# Hướng dẫn Frontend - TinyMCE cho PDF Generation

## ✅ Khuyến nghị: Lưu HTML thuần từ TinyMCE

Khi dùng Puppeteer, bạn chỉ cần lưu HTML content từ TinyMCE là đủ, không cần làm gì thêm!

## 📝 Cách lưu data từ TinyMCE

### 1. Lưu HTML content trực tiếp (KHUYẾN NGHỊ)

```typescript
// Frontend - TinyMCE
const editorContent = editor.getContent(); // HTML string

// Lưu vào database
const thesisData = {
  description: editorContent, // HTML string từ TinyMCE
  // ... other fields
};
```

**Ưu điểm:**
- ✅ Đơn giản, TinyMCE đã làm sẵn
- ✅ Puppeteer render được hết (lists, tables, styles)
- ✅ Không cần thêm logic

### 2. Lưu kèm plain text (optional - nếu muốn search)

```typescript
const editorContent = editor.getContent(); // HTML
const plainText = editor.getContent({ format: 'text' }); // Plain text

const thesisData = {
  description: editorContent, // HTML
  descriptionPlain: plainText, // Plain text cho search
};
```

## 🎨 TinyMCE Configuration

### Recommended TinyMCE Setup

```typescript
tinymce.init({
  selector: '#description-editor',
  height: 500,
  plugins: [
    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
    'preview', 'anchor', 'searchreplace', 'visualblocks', 'code',
    'fullscreen', 'insertdatetime', 'media', 'table', 'help'
  ],
  toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist | table | link image | code',
  
  // Quan trọng: Giữ HTML structure
  keep_styles: true,
  paste_as_text: false, // Giữ formatting khi paste
  
  // Xử lý tables
  table_default_attributes: {
    border: '1'
  },
  
  // Xử lý lists
  lists_indent_on_tab: true,
});
```

## 📋 HTML Elements được hỗ trợ tốt

### ✅ Hỗ trợ tốt (render đẹp):
- `<ul>`, `<ol>`, `<li>` - Lists
- `<table>`, `<tr>`, `<td>`, `<th>` - Tables
- `<h1>` - `<h6>` - Headings
- `<p>` - Paragraphs
- `<strong>`, `<b>` - Bold
- `<em>`, `<i>` - Italic
- `<div>`, `<span>` - Containers
- `<br>` - Line breaks

### ⚠️ Hạn chế:
- CSS classes từ TailwindCSS → không render trong PDF (nhưng vẫn render trên web)
- Inline styles → OK
- Images → cần absolute URL
- Custom fonts → cần embed trong HTML template

## 🚀 Example: Submit form với TinyMCE

```typescript
// React/Next.js example
const handleSubmit = async (formData) => {
  const editorContent = tinymce.get('description').getContent();
  
  const payload = {
    ...formData,
    description: editorContent, // HTML string
  };
  
  await fetch('/api/thesis', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
```

## 💡 Tips

1. **Giữ HTML structure:** Không strip HTML tags, để nguyên
2. **Inline styles OK:** `<p style="color: red;">` → render được
3. **Classes từ TailwindCSS:** Vẫn OK cho web, nhưng PDF sẽ dùng CSS trong template
4. **Images:** Dùng absolute URL (`https://...`) thay vì relative path
5. **Entities:** TinyMCE tự động encode (ý → &yacute;) → Puppeteer tự decode

## 📦 Backend sẽ nhận

```typescript
// Backend nhận được
{
  description: `<div><h3>Lưu ý</h3><ul><li>Item 1</li></ul><table>...</table></div>`
}
```

→ Puppeteer sẽ render y hệt như trên browser! ✨

