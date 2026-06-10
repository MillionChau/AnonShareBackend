# 📋 KẾ HOẠCH KIỂM THỬ API — POSTMAN TEST PLANNING

> **Ứng dụng:** Anonymous Social Platform  
> **Ngôn ngữ:** NestJS + MongoDB  
> **Base URL:** `{{BASE_URL}}` (ví dụ: `http://localhost:3000`)  
> **Biến môi trường Postman cần khai báo:**
> - `BASE_URL` — địa chỉ server
> - `TOKEN` — JWT token sau khi đăng nhập (tự động set qua test script)
> - `ANON_ID` — displayId của user (tự động set)
> - `POST_ID` — ID bài viết (tự động set)
> - `COMMENT_ID` — ID bình luận (tự động set)
> - `REPORT_ID` — ID báo cáo (tự động set)
> - `NOTIF_ID` — ID thông báo (tự động set)

---

## MODULE 1 — AUTH (Xác thực)

### TC-AUTH-001 · Tạo phiên ẩn danh lần đầu (thành công)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/auth/anonymous` |
| **Headers** | `Content-Type: application/json` |
| **Body (raw JSON)** | `{ "password": "MatKhau@123" }` |
| **Kỳ vọng** | Status `200 OK` |

**Body mong đợi:**
```json
{
  "anonymousId": "Anonymous12345678",
  "token": "<jwt_string>",
  "isNew": true,
  "createdAt": "<iso_date>"
}
```

**Test Script (Postman):**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Có trả về token", () => {
    const json = pm.response.json();
    pm.expect(json.token).to.be.a("string").and.not.empty;
    pm.environment.set("TOKEN", json.token);
    pm.environment.set("ANON_ID", json.anonymousId);
});
pm.test("isNew = true khi tạo lần đầu", () => {
    pm.expect(pm.response.json().isNew).to.be.true;
});
```

---

### TC-AUTH-002 · Tạo phiên ẩn danh — thiếu password (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/auth/anonymous` |
| **Body** | `{}` |
| **Kỳ vọng** | Status `400 Bad Request` |

**Test Script:**
```javascript
pm.test("Status 400", () => pm.response.to.have.status(400));
pm.test("Có message lỗi", () => {
    pm.expect(pm.response.json().message).to.exist;
});
```

---

### TC-AUTH-003 · Đăng nhập bằng anonymousId + password (thành công)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/auth/login` |
| **Body** | `{ "anonymousId": "{{ANON_ID}}", "password": "MatKhau@123" }` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Token hợp lệ", () => {
    const json = pm.response.json();
    pm.expect(json.token).to.be.a("string");
    pm.environment.set("TOKEN", json.token);
});
pm.test("isNew = false khi đăng nhập lại", () => {
    pm.expect(pm.response.json().isNew).to.be.false;
});
```

---

### TC-AUTH-004 · Đăng nhập — sai mật khẩu (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/auth/login` |
| **Body** | `{ "anonymousId": "{{ANON_ID}}", "password": "SaiMatKhau" }` |
| **Kỳ vọng** | Status `401 Unauthorized` |

**Test Script:**
```javascript
pm.test("Status 401", () => pm.response.to.have.status(401));
```

---

### TC-AUTH-005 · Đăng nhập — anonymousId không tồn tại (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/auth/login` |
| **Body** | `{ "anonymousId": "Anonymous00000000", "password": "BatKy@123" }` |
| **Kỳ vọng** | Status `401 Unauthorized` |

---

## MODULE 2 — POSTS (Bài viết)

> ⚠️ Các request cần xác thực phải thêm header:  
> `Authorization: Bearer {{TOKEN}}`

---

### TC-POST-001 · Tạo bài viết mới (thành công)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/posts` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Body** | Xem bên dưới |

**Body (raw JSON):**
```json
{
  "content": "Đây là bài viết đầu tiên của tôi trên nền tảng ẩn danh này! 🎉",
  "visibility": "public"
}
```

**Kỳ vọng:** Status `201 Created`

**Test Script:**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Lưu POST_ID", () => {
    const json = pm.response.json();
    pm.expect(json._id || json.id).to.exist;
    pm.environment.set("POST_ID", json._id || json.id);
});
pm.test("Content khớp", () => {
    const json = pm.response.json();
    pm.expect(json.content).to.include("bài viết đầu tiên");
});
```

---

### TC-POST-002 · Tạo bài viết — không có token (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/posts` |
| **Headers** | *(không có Authorization)* |
| **Body** | `{ "content": "Bài viết không có token" }` |
| **Kỳ vọng** | Status `401 Unauthorized` |

---

### TC-POST-003 · Lấy danh sách bài viết (phân trang)
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/posts?page=1&limit=10` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Trả về mảng bài viết", () => {
    const json = pm.response.json();
    pm.expect(json.posts || json.data || json).to.be.an("array").or.to.be.an("object");
});
```

---

### TC-POST-004 · Lấy chi tiết bài viết theo ID
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/posts/{{POST_ID}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("ID khớp", () => {
    const json = pm.response.json();
    pm.expect(json._id || json.id).to.equal(pm.environment.get("POST_ID"));
});
```

---

### TC-POST-005 · Lấy bài viết — ID không tồn tại (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/posts/000000000000000000000000` |
| **Kỳ vọng** | Status `404 Not Found` |

---

### TC-POST-006 · Lấy bài viết theo người dùng
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/posts/user/{{ANON_ID}}?page=1&limit=5` |
| **Kỳ vọng** | Status `200 OK` |

---

### TC-POST-007 · Cập nhật bài viết (thành công)
| Trường | Giá trị |
|--------|---------|
| **Method** | `PUT` |
| **URL** | `{{BASE_URL}}/posts/{{POST_ID}}` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Body** | `{ "content": "Nội dung đã được cập nhật lại rồi nhé! ✍️" }` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Content đã thay đổi", () => {
    pm.expect(pm.response.json().content).to.include("cập nhật lại");
});
```

---

### TC-POST-008 · Cập nhật trạng thái bài viết
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/posts/{{POST_ID}}/status` |
| **Body** | `{ "status": "hidden" }` |
| **Kỳ vọng** | Status `200 OK` |

---

### TC-POST-009 · Like / Unlike bài viết (toggle)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/posts/{{POST_ID}}/like` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Có isLiked và likeCount", () => {
    const json = pm.response.json();
    pm.expect(json.isLiked).to.be.a("boolean");
    pm.expect(json.likeCount).to.be.a("number");
});
```

---

### TC-POST-010 · Xóa bài viết (soft delete)
| Trường | Giá trị |
|--------|---------|
| **Method** | `DELETE` |
| **URL** | `{{BASE_URL}}/posts/{{POST_ID}}` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Có message xác nhận", () => {
    pm.expect(pm.response.json().message).to.exist;
});
```

---

## MODULE 3 — COMMENTS (Bình luận)

> ⚠️ Toàn bộ module Comment yêu cầu `Authorization: Bearer {{TOKEN}}`  
> (Controller áp dụng `AnonKeyGuard` ở cấp class)

---

### TC-CMT-001 · Tạo bình luận mới trên bài viết (thành công)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/comments` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Body** | Xem bên dưới |

**Body (raw JSON):**
```json
{
  "postId": "{{POST_ID}}",
  "content": "Ôi, bài viết này hay quá! Cảm ơn bạn đã chia sẻ nhé 😊"
}
```

**Kỳ vọng:** Status `201 Created`

**Test Script:**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Lưu COMMENT_ID", () => {
    const json = pm.response.json();
    const commentId = json.comment?._id || json._id || json.commentId;
    pm.expect(commentId).to.exist;
    pm.environment.set("COMMENT_ID", commentId);
});
pm.test("Content khớp", () => {
    const json = pm.response.json();
    const content = json.comment?.content || json.content;
    pm.expect(content).to.include("hay quá");
});
```

---

### TC-CMT-002 · Tạo bình luận — nội dung rỗng (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/comments` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Body** | `{ "postId": "{{POST_ID}}", "content": "" }` |
| **Kỳ vọng** | Status `400 Bad Request` |

---

### TC-CMT-003 · Tạo bình luận trả lời (reply)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/comments` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Body** | Xem bên dưới |

**Body (raw JSON):**
```json
{
  "postId": "{{POST_ID}}",
  "parentId": "{{COMMENT_ID}}",
  "content": "Mình cũng đồng ý với bạn! Nội dung thật sự rất hữu ích 👍"
}
```

**Kỳ vọng:** Status `201 Created`

---

### TC-CMT-004 · Lấy danh sách bình luận theo bài viết
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/comments/post/{{POST_ID}}?page=1&limit=10` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Trả về danh sách bình luận", () => {
    const json = pm.response.json();
    pm.expect(json.comments || json.data || json).to.be.an("array").or.to.be.an("object");
});
```

---

### TC-CMT-005 · Lấy replies của một bình luận
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/comments/{{COMMENT_ID}}/replies?page=1&limit=10` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Kỳ vọng** | Status `200 OK` |

---

### TC-CMT-006 · Lấy chi tiết một bình luận
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/comments/{{COMMENT_ID}}` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Kỳ vọng** | Status `200 OK` |

---

### TC-CMT-007 · Cập nhật nội dung bình luận
| Trường | Giá trị |
|--------|---------|
| **Method** | `PUT` |
| **URL** | `{{BASE_URL}}/comments/{{COMMENT_ID}}` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Body** | `{ "content": "Mình đã chỉnh sửa lại bình luận này cho rõ hơn nhé!" }` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Nội dung đã cập nhật", () => {
    pm.expect(pm.response.json().content).to.include("chỉnh sửa lại");
});
```

---

### TC-CMT-008 · Like / Unlike bình luận (toggle)
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/comments/{{COMMENT_ID}}/like` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Có isLiked và likeCount", () => {
    const json = pm.response.json();
    pm.expect(json.isLiked).to.be.a("boolean");
    pm.expect(json.likeCount).to.be.a("number");
});
```

---

### TC-CMT-009 · Xóa bình luận
| Trường | Giá trị |
|--------|---------|
| **Method** | `DELETE` |
| **URL** | `{{BASE_URL}}/comments/{{COMMENT_ID}}` |
| **Headers** | `Authorization: Bearer {{TOKEN}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Có message xác nhận", () => {
    pm.expect(pm.response.json().message).to.exist;
});
```

---

### TC-CMT-010 · Xóa bình luận — không phải tác giả (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `DELETE` |
| **URL** | `{{BASE_URL}}/comments/{{COMMENT_ID}}` |
| **Headers** | `Authorization: Bearer {{TOKEN_OTHER_USER}}` |
| **Kỳ vọng** | Status `403 Forbidden` |

---

## MODULE 4 — REPORTS (Báo cáo)

---

### TC-RPT-001 · Tạo báo cáo bài viết (thành công)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/reports/{{ANON_ID}}` |
| **Body** | Xem bên dưới |

**Body (raw JSON):**
```json
{
  "targetType": "POST",
  "targetId": "{{POST_ID}}",
  "reason": "spam",
  "description": "Bài viết này có nội dung quảng cáo không phù hợp với cộng đồng."
}
```

**Kỳ vọng:** Status `201 Created`

**Test Script:**
```javascript
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Lưu REPORT_ID", () => {
    const json = pm.response.json();
    const reportId = json.report?._id || json._id;
    pm.expect(reportId).to.exist;
    pm.environment.set("REPORT_ID", reportId);
});
pm.test("Có message xác nhận", () => {
    pm.expect(pm.response.json().message).to.include("thành công");
});
```

---

### TC-RPT-002 · Tạo báo cáo bình luận (thành công)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/reports/{{ANON_ID}}` |
| **Body** | Xem bên dưới |

**Body (raw JSON):**
```json
{
  "targetType": "COMMENT",
  "targetId": "{{COMMENT_ID}}",
  "reason": "harassment",
  "description": "Bình luận này có lời lẽ xúc phạm và nhắm vào cá nhân một người dùng khác."
}
```

**Kỳ vọng:** Status `201 Created`

---

### TC-RPT-003 · Báo cáo trùng lặp (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/reports/{{ANON_ID}}` |
| **Body** | *(Giống TC-RPT-001, cùng targetId)* |
| **Kỳ vọng** | Status `409 Conflict` |

**Test Script:**
```javascript
pm.test("Status 409", () => pm.response.to.have.status(409));
pm.test("Thông báo đã báo cáo rồi", () => {
    pm.expect(pm.response.json().message).to.include("đã báo cáo");
});
```

---

### TC-RPT-004 · Tự báo cáo bài viết của mình (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `POST` |
| **URL** | `{{BASE_URL}}/reports/{{ANON_ID}}` |
| **Body** | `{ "targetType": "POST", "targetId": "{{MY_OWN_POST_ID}}", "reason": "spam" }` |
| **Kỳ vọng** | Status `400 Bad Request` |

**Test Script:**
```javascript
pm.test("Status 400", () => pm.response.to.have.status(400));
pm.test("Không được tự báo cáo mình", () => {
    pm.expect(pm.response.json().message).to.include("chính mình");
});
```

---

### TC-RPT-005 · Xem danh sách báo cáo của mình
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/reports/{{ANON_ID}}/my?page=1&limit=10` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Trả về danh sách và phân trang", () => {
    const json = pm.response.json();
    pm.expect(json.reports).to.be.an("array");
    pm.expect(json.total).to.be.a("number");
    pm.expect(json.page).to.equal(1);
});
```

---

### TC-RPT-006 · Xem danh sách báo cáo của mình — lọc theo status
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/reports/{{ANON_ID}}/my?status=pending&targetType=POST` |
| **Kỳ vọng** | Status `200 OK` |

---

### TC-RPT-007 (Admin) · Lấy tất cả báo cáo
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/reports/admin/all?page=1&limit=20` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Cấu trúc phân trang đúng", () => {
    const json = pm.response.json();
    pm.expect(json.reports).to.be.an("array");
    pm.expect(json.hasMore).to.be.a("boolean");
});
```

---

### TC-RPT-008 (Admin) · Xem chi tiết một báo cáo
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/reports/admin/{{REPORT_ID}}` |
| **Kỳ vọng** | Status `200 OK` |

---

### TC-RPT-009 (Admin) · Đánh dấu báo cáo đang được xem xét
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/reports/admin/{{ANON_ID}}/review/{{REPORT_ID}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Status chuyển sang reviewed", () => {
    pm.expect(pm.response.json().status).to.equal("reviewed");
});
```

---

### TC-RPT-010 (Admin) · Xử lý báo cáo — resolved
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/reports/admin/{{ANON_ID}}/resolve` |
| **Body** | Xem bên dưới |

**Body (raw JSON):**
```json
{
  "reportId": "{{REPORT_ID}}",
  "action": "resolved",
  "adminNote": "Đã xác nhận vi phạm và thực hiện biện pháp xử lý phù hợp."
}
```

**Kỳ vọng:** Status `200 OK`

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Status = resolved", () => {
    pm.expect(pm.response.json().status).to.equal("resolved");
});
pm.test("resolvedAt có giá trị", () => {
    pm.expect(pm.response.json().resolvedAt).to.not.be.null;
});
```

---

### TC-RPT-011 (Admin) · Xử lý báo cáo — dismissed
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/reports/admin/{{ANON_ID}}/resolve` |
| **Body** | `{ "reportId": "{{REPORT_ID}}", "action": "dismissed", "adminNote": "Báo cáo không có cơ sở, không tìm thấy vi phạm." }` |
| **Kỳ vọng** | Status `200 OK` |

---

### TC-RPT-012 (Admin) · Xử lý báo cáo đã xử lý rồi (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/reports/admin/{{ANON_ID}}/resolve` |
| **Body** | *(Cùng reportId đã resolved)* |
| **Kỳ vọng** | Status `400 Bad Request` |

**Test Script:**
```javascript
pm.test("Status 400", () => pm.response.to.have.status(400));
pm.test("Thông báo đã xử lý", () => {
    pm.expect(pm.response.json().message).to.include("đã được xử lý");
});
```

---

### TC-RPT-013 (Admin) · Xóa báo cáo
| Trường | Giá trị |
|--------|---------|
| **Method** | `DELETE` |
| **URL** | `{{BASE_URL}}/reports/admin/{{REPORT_ID}}` |
| **Kỳ vọng** | Status `204 No Content` |

**Test Script:**
```javascript
pm.test("Status 204", () => pm.response.to.have.status(204));
```

---

## MODULE 5 — NOTIFICATIONS (Thông báo)

---

### TC-NOTIF-001 · Lấy danh sách thông báo
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}?page=1&limit=20` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Cấu trúc đúng", () => {
    const json = pm.response.json();
    pm.expect(json.notifications).to.be.an("array");
    pm.expect(json.unreadCount).to.be.a("number");
    pm.expect(json.hasMore).to.be.a("boolean");
});
pm.test("Lưu NOTIF_ID nếu có", () => {
    const json = pm.response.json();
    if (json.notifications.length > 0) {
        pm.environment.set("NOTIF_ID", json.notifications[0].notificationId);
    }
});
```

---

### TC-NOTIF-002 · Lấy danh sách thông báo — lọc chưa đọc
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}?status=unread` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Tất cả thông báo đều chưa đọc", () => {
    const json = pm.response.json();
    json.notifications.forEach(n => {
        pm.expect(n.status).to.equal("unread");
    });
});
```

---

### TC-NOTIF-003 · Lấy số badge thông báo chưa đọc
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}/badge` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Có unreadCount", () => {
    pm.expect(pm.response.json().unreadCount).to.be.a("number").and.at.least(0);
});
```

---

### TC-NOTIF-004 · Lấy chi tiết một thông báo
| Trường | Giá trị |
|--------|---------|
| **Method** | `GET` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}/{{NOTIF_ID}}` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("ID khớp", () => {
    pm.expect(pm.response.json().notificationId).to.equal(pm.environment.get("NOTIF_ID"));
});
```

---

### TC-NOTIF-005 · Đánh dấu đã đọc một thông báo
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}/read` |
| **Body** | `{ "notificationId": "{{NOTIF_ID}}" }` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Status = read", () => {
    pm.expect(pm.response.json().status).to.equal("read");
});
pm.test("readAt có giá trị", () => {
    pm.expect(pm.response.json().readAt).to.not.be.null;
});
```

---

### TC-NOTIF-006 · Đánh dấu tất cả đã đọc
| Trường | Giá trị |
|--------|---------|
| **Method** | `PATCH` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}/read-all` |
| **Body** | `{ "confirm": true }` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("updatedCount >= 0", () => {
    pm.expect(pm.response.json().updatedCount).to.be.a("number").and.at.least(0);
});
```

---

### TC-NOTIF-007 · Xóa một thông báo
| Trường | Giá trị |
|--------|---------|
| **Method** | `DELETE` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}/{{NOTIF_ID}}` |
| **Kỳ vọng** | Status `204 No Content` |

**Test Script:**
```javascript
pm.test("Status 204", () => pm.response.to.have.status(204));
```

---

### TC-NOTIF-008 · Xóa thông báo không tồn tại (thất bại)
| Trường | Giá trị |
|--------|---------|
| **Method** | `DELETE` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}/000000000000000000000000` |
| **Kỳ vọng** | Status `404 Not Found` |

---

### TC-NOTIF-009 · Xóa tất cả thông báo đã đọc
| Trường | Giá trị |
|--------|---------|
| **Method** | `DELETE` |
| **URL** | `{{BASE_URL}}/notifications/{{ANON_ID}}/read` |
| **Kỳ vọng** | Status `200 OK` |

**Test Script:**
```javascript
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("deletedCount >= 0", () => {
    pm.expect(pm.response.json().deletedCount).to.be.a("number").and.at.least(0);
});
```

---

## THỨ TỰ CHẠY TEST (Postman Collection Runner)

```
1. TC-AUTH-001  → Tạo tài khoản + lấy TOKEN, ANON_ID
2. TC-AUTH-003  → Đăng nhập lại, xác nhận TOKEN
3. TC-POST-001  → Tạo bài viết, lấy POST_ID
4. TC-POST-003  → Lấy danh sách bài viết
5. TC-POST-004  → Lấy chi tiết bài viết
6. TC-CMT-001   → Tạo bình luận, lấy COMMENT_ID
7. TC-CMT-003   → Tạo reply
8. TC-CMT-004   → Lấy danh sách bình luận
9. TC-POST-009  → Like bài viết
10. TC-CMT-008  → Like bình luận
11. TC-RPT-001  → Báo cáo (dùng tài khoản khác báo cáo)
12. TC-RPT-005  → Xem báo cáo của mình
13. TC-RPT-007  → Admin xem toàn bộ báo cáo
14. TC-RPT-009  → Admin đánh dấu reviewed
15. TC-RPT-010  → Admin resolve báo cáo
16. TC-NOTIF-001 → Xem thông báo (sau khi bị báo cáo)
17. TC-NOTIF-003 → Xem badge
18. TC-NOTIF-005 → Đánh dấu đã đọc
19. TC-NOTIF-006 → Đánh dấu tất cả đã đọc
20. TC-CMT-009  → Xóa bình luận
21. TC-POST-010 → Xóa bài viết
22. TC-AUTH-002 → Test case lỗi: thiếu password
23. TC-AUTH-004 → Test case lỗi: sai mật khẩu
24. TC-RPT-012  → Test case lỗi: xử lý báo cáo đã xử lý
```

---

## TỔNG HỢP TEST CASES

| Module | Tổng TC | Happy Path | Error Case |
|--------|---------|-----------|------------|
| Auth | 5 | 3 | 2 |
| Posts | 10 | 7 | 3 |
| Comments | 10 | 8 | 2 |
| Reports | 13 | 9 | 4 |
| Notifications | 9 | 7 | 2 |
| **Tổng** | **47** | **34** | **13** |

---