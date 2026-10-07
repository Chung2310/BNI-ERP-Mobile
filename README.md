# iGen Connect Mobile

Workspace thiết kế và phát triển ứng dụng mobile cho hệ thống iGen Connect.

## Duyệt wireframe vòng 1

Mở [wireframes/index.html](wireframes/index.html) bằng trình duyệt. Prototype gồm 21 màn hình, cho phép:

- chuyển giữa khung điện thoại và tablet;
- chọn trực tiếp từng màn hình từ danh sách;
- bấm bottom navigation và một số card để đi qua các luồng chính.

Tài liệu liên quan:

- [Quy chuẩn UI dự thảo](docs/UI-STANDARDS-DRAFT.md)
- [Checklist duyệt wireframe](docs/WIREFRAME-REVIEW.md)

Wireframe này dùng để duyệt cấu trúc và thứ tự thông tin. Kích thước chữ, icon, màu chi tiết và motion sẽ được hoàn thiện ở giai đoạn high-fidelity sau khi wireframe được duyệt.

## Chạy ứng dụng Expo

Yêu cầu Node.js LTS và Expo Go tương thích SDK 57.

1. Sao chép `.env.example` thành `.env` và đặt `EXPO_PUBLIC_API_URL` tới API BNI-ERP. Khi chạy trên điện thoại thật, dùng IP LAN của máy phát triển thay cho `localhost`.
2. Cài dependency bằng `npm install`.
3. Chạy `npm start`, sau đó quét QR bằng Expo Go; hoặc dùng `npm run android`, `npm run ios`, `npm run web`.

Các lệnh kiểm tra:

- `npm run typecheck`
- `npm run lint`
- `npm run doctor`

Mã ứng dụng nằm trong `src/app`. Ứng dụng đã kết nối các API BNI-ERP cho đăng nhập/refresh phiên, cuộc họp, QR/GPS check-in, điều hành và quay thưởng, thành viên, chat, thông báo, phí, tài nguyên và phân quyền. Bảng xếp hạng được tổng hợp từ lịch sử check-in/phát biểu của cuộc họp.

Camera, vị trí và Face ID cần kiểm thử bằng development build trên thiết bị thật trước khi phát hành. Chạy `npx expo run:android` hoặc `npx expo run:ios` sau khi môi trường native đã được cài đặt.
