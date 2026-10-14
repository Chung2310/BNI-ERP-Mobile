# iGen Connect Mobile

Workspace thiết kế và phát triển ứng dụng mobile cho hệ thống iGen Connect.

## Duyệt wireframe vòng 1

Mở [wireframes/index.html](wireframes/index.html) bằng trình duyệt. Prototype gồm 20 màn hình, cho phép:

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

Mã ứng dụng nằm trong `src/app`. Ứng dụng đã kết nối các API BNI-ERP cho đăng nhập/refresh phiên, cuộc họp, QR/GPS check-in, điều hành và quay thưởng, thành viên, chat, thông báo, tài nguyên và phân quyền. Bảng xếp hạng được tổng hợp từ lịch sử check-in/phát biểu của cuộc họp.

Camera, vị trí và Face ID cần kiểm thử bằng development build trên thiết bị thật trước khi phát hành. Chạy `npx expo run:android` hoặc `npx expo run:ios` sau khi môi trường native đã được cài đặt.

## Thông báo đẩy trên iPhone

iOS dùng Expo Push Service để chuyển thông báo tới APNs; Android tiếp tục dùng FCM trực tiếp. Thông báo dạng có tiêu đề và nội dung được iOS hiển thị ở Notification Center khi app ở nền hoặc đã đóng. Chạm vào thông báo sẽ mở màn hình đích trong app. Việc chạy JavaScript âm thầm khi app ở nền do iOS quyết định và không được đảm bảo.

Để bật push iOS:

1. Tạo/liên kết ứng dụng với một EAS project và đặt UUID của project vào `EXPO_PUBLIC_EAS_PROJECT_ID` trong môi trường build hoặc `.env`.
2. Trong EAS, cấu hình Apple Push Notifications service key (APNs) cho bundle ID `com.igen.bni`. Cần Apple Developer account trả phí.
3. Cài app bằng development/release build trên iPhone thật và chấp nhận quyền thông báo. Expo Go không đăng ký push trong app này.
4. Backend cần có `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`; backend dùng thông tin này cho FCM Android, còn iOS được gửi qua Expo Push Service.

`app.json` đã bật `enableBackgroundRemoteNotifications`; sau khi thay đổi cấu hình native, cần tạo lại build iOS. Push token iOS được đăng ký với backend dưới dạng Expo token, không phải APNs token thô.

## CI/CD iOS lên App Store Connect

Workflow [iOS App Store build and upload](.github/workflows/ios-app-store.yml) chạy khi push lên nhánh `production` hoặc khi chạy thủ công trên nhánh này. Workflow chạy lint/typecheck, build iOS bằng EAS, rồi upload bản `.ipa` lên App Store Connect.

Thiết lập trong GitHub repository, tại **Settings → Secrets and variables → Actions**:

- Variables: `EAS_PROJECT_ID`, `ASC_APP_ID`, `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `EXPO_PUBLIC_API_URL` (URL API production dạng HTTPS).
- Secrets: `EXPO_TOKEN` (Expo access token), `ASC_API_KEY_P8` (toàn bộ nội dung file App Store Connect `.p8`).

Trước lần chạy đầu, cấu hình iOS Distribution certificate/provisioning profile và APNs key cho bundle ID `com.igen.bni` trong EAS. Workflow mặc định upload build lên App Store Connect/TestFlight; gửi bản lên Apple App Review để phát hành công khai vẫn cần thao tác trong App Store Connect.
