# iGen Connect Mobile — Quy chuẩn giao diện dự thảo v1

Trạng thái: chờ duyệt wireframe. Đây là nền tảng để dựng high-fidelity design system sau khi cấu trúc màn hình được chấp thuận.

## 1. Quyết định đã chốt

- Tên sản phẩm: **iGen Connect**.
- Phạm vi mobile: đầy đủ chức năng theo quyền, gồm nghiệp vụ thành viên và quản trị.
- Điều hướng chính: **Trang chủ · Cuộc họp · Thành viên · Trò chuyện · Thêm**.
- Màu chủ đạo: cyan và trắng; giai đoạn đầu chỉ có light mode.
- Mật độ: cân bằng giữa dữ liệu ERP và khả năng thao tác bằng một tay.
- Phong cách: native-adaptive, không sao chép nguyên bố cục desktop.
- Sơ đồ tổ chức: giữ dạng cây, có pan, zoom, fit-to-screen và chế độ danh sách.
- Trang Thành viên mặc định dùng lưới thẻ như web; sơ đồ tổ chức là chế độ phụ.
- Xác thực: lần đầu dùng tài khoản; Face ID/vân tay là tùy chọn trong Cài đặt.
- Thông báo: deep link tới đúng cuộc họp, chat hoặc tài nguyên.
- Mạng: online-only; lỗi phải nêu nguyên nhân và cung cấp **Thử lại**.
- Thiết bị: điện thoại và tablet; màn hình điều hành có bố cục tablet riêng.

## 2. Nền tảng thị giác

| Token | Giá trị dự thảo | Mục đích |
|---|---:|---|
| Primary | `#00AECA` | CTA, tab đang chọn, trạng thái chủ động |
| Primary dark | `#007F98` | Chữ/link trên nền sáng |
| Primary soft | `#E4F8FB` | Badge và vùng chọn nhẹ |
| Surface | `#FFFFFF` | Card, sheet, navigation |
| Background | `#F7FAFB` | Nền ứng dụng |
| Text | `#102533` | Nội dung chính |
| Muted | `#6D7F89` | Nội dung phụ |
| Border | `#D9E3E8` | Viền và phân tách |
| Danger | `#D9485F` | Xóa, kết thúc họp, lỗi nghiêm trọng |
| Warning | `#D99020` | Sắp đến hạn, cần chú ý |

Màu đỏ chỉ dùng cho cảnh báo, thao tác phá hủy và trạng thái live; không dùng làm màu thương hiệu chính.

### Chữ

- Font: Inter, fallback Be Vietnam Pro.
- Nội dung thường: 14–16px; nội dung phụ không nhỏ hơn 12px.
- Tiêu đề màn hình: 20–24px.
- Nút: tối thiểu 14px, semibold/bold.
- Bộ đếm và số liệu dùng tabular numbers.
- Kích thước chữ trong wireframe chỉ để mô phỏng bố cục, không phải thông số UI cuối.

### Khoảng cách và vùng chạm

- Lưới cơ sở 4px; khoảng cách phổ biến 8, 12, 16 và 24px.
- Vùng chạm tối thiểu 44×44pt trên iOS và 48×48dp trên Android.
- Card bo góc 12–16px; bottom sheet bo góc trên 20–24px.
- Nút chính cao 48px; icon compact vẫn phải giữ vùng chạm tối thiểu.

## 3. Điều hướng

- Bottom navigation luôn có 5 mục và giữ thứ tự cố định.
- Màn hình con dùng back navigation native.
- **Thêm** chứa Bảng xếp hạng, Tài nguyên, Thông báo, Quản trị và Cài đặt.
- Module không có quyền truy cập được ẩn khỏi điều hướng.
- Deep link phải phục hồi đúng tab, màn hình con và đối tượng nghiệp vụ.

## 4. Quy tắc nghiệp vụ

### Cuộc họp

- Tách chế độ thành viên và chế độ điều hành theo quyền.
- Danh sách cuộc họp lấy lịch tháng làm giao diện chính.
- Tương tác và quay thưởng là chức năng con trong Chi tiết cuộc họp.
- Trạng thái live luôn có nhãn chữ, không truyền đạt chỉ bằng màu.
- Kết thúc, hủy hoặc xóa phải xác nhận và mô tả hậu quả.
- Bộ đếm được ưu tiên khả năng đọc, không đặt chung với quá nhiều hành động.
- Tablet dùng hai cột: diễn giả/bộ đếm và danh sách chờ.

### Sơ đồ tổ chức

- Danh sách thành viên mặc định hiển thị bằng thẻ để đọc nhanh trên mobile.
- Canvas hỗ trợ pan, pinch-to-zoom, phóng to/thu nhỏ và fit-to-screen.
- Chạm node mở hồ sơ thành viên.
- Luôn có chế độ danh sách tương đương để tìm kiếm và hỗ trợ accessibility.

### Chat

- Điện thoại dùng hai màn hình: danh sách phòng và phòng chat.
- Tablet có thể dùng master-detail.
- Tin chưa đọc, mention và trạng thái gửi có ký hiệu kèm semantics.

### Dữ liệu và quản trị

- Bảng desktop chuyển thành card hoặc master-detail.
- Bảng xếp hạng top thành viên hiển thị theo cột; danh sách chi tiết nằm phía dưới.
- Bộ lọc dài mở bằng bottom sheet.
- Ma trận quyền nhóm theo module; không dùng bảng cuộn ngang trên điện thoại.

## 5. Trạng thái bắt buộc

Mỗi màn hình khi triển khai phải có: loading/skeleton, dữ liệu rỗng, lỗi có nút thử lại, mất quyền truy cập và dữ liệu thành công. Form có validation tại trường và thông báo tổng quát khi gửi thất bại.

## 6. Accessibility

- Tương phản tối thiểu WCAG AA.
- Không truyền đạt trạng thái chỉ bằng màu.
- Hỗ trợ tăng cỡ chữ tối thiểu 130% mà không mất thao tác chính.
- Thứ tự focus và nhãn đọc màn hình theo trình tự nghiệp vụ.
- Canvas như sơ đồ tổ chức có chế độ danh sách tương đương.
