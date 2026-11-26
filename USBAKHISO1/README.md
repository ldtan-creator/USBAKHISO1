# USBAKHISO1 - Full Source Code (Đã tích hợp Phân quyền Admin & 107 Sản phẩm có hình ảnh thực tế)

## 1. Cấu trúc thư mục hoàn chỉnh
- `server.js`: Máy chủ Node.js + SQLite (tích hợp xác thực Bearer Token, phân quyền Admin/Customer, tự động trừ tồn kho).
- `auth-guard.js`: Lớp bảo vệ tự động chặn truy cập trái phép vào `admin.html` và đính kèm Token xác thực cho mọi API.
- `index.html`: Trang chủ hiển thị danh mục, sản phẩm nổi bật có ảnh thực tế và nút truy cập nhanh trang Admin (chỉ hiện với Admin).
- `products.html`: Trang danh sách toàn bộ 107 sản phẩm & phụ kiện, có lọc theo danh mục, thương hiệu, tìm kiếm và sắp xếp giá.
- `cart.html`: Trang giỏ hàng, đặt hàng (COD / Chuyển khoản) và xem lịch sử đơn hàng cá nhân.
- `admin.html`: Trang quản trị dành riêng cho Admin (Thống kê doanh thu, duyệt/xóa đơn hàng, cập nhật giá & tồn kho 107 SKU).
- `app.js`: Xử lý giao diện dùng chung, giỏ hàng và hộp thoại Đăng nhập / Đăng ký.
- `catalog-products.js` & `catalog-products.json`: Dữ liệu 107 sản phẩm & phụ kiện Apple, Samsung, Xiaomi, Redmi, ASUS, Dell kèm hình ảnh thực tế.

## 2. Hướng dẫn chạy
1. Giải nén toàn bộ thư mục này vào một thư mục trên máy tính (ví dụ `D:\USBAKHISO1`).
2. Mở Terminal tại thư mục đó và chạy lệnh:
   ```bash
   node server.js
   ```
3. Truy cập `http://localhost:3000/index.html`.
4. Đăng nhập tài khoản Admin mặc định:
   - **Email:** `admin@usbak.vn`
   - **Mật khẩu:** `Admin@123`
