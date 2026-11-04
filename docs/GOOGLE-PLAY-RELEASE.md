# Phát hành iGen Connect lên Google Play

Ứng dụng dùng package `com.igen.connect`, version hiển thị lấy từ `app.json` (hiện là `1.0.0`). Workflow **Google Play AAB** build trực tiếp bằng Gradle trên GitHub Actions, ký bằng upload keystore của tổ chức và trả file AAB trong Artifacts. Không dùng EAS Build, Expo Submit, tài khoản Expo, `EXPO_TOKEN` hay `EAS_PROJECT_ID`. Expo SDK vẫn là thư viện của app; Expo CLI chạy tại máy build để sinh Android project và đóng gói JavaScript. [Build Android trực tiếp](https://docs.expo.dev/guides/local-app-production/)

## 1. Chuẩn bị một lần

Chốt URL HTTPS của backend production và triển khai backend trước khi thử app mới. Firebase phải có Android app package `com.igen.connect`; tải **client config** `google-services.json` của app đó. Backend cần Firebase service account cùng project để gửi FCM; service account này giữ trên server, không đưa vào app.

Tạo upload key lâu dài nếu ứng dụng chưa có khóa phát hành. Nếu package đã có trên Play Console, dùng lại upload key đã đăng ký thay vì tạo khóa mới. Có thể dùng Android Studio hoặc chạy lệnh sau; `keytool` sẽ hỏi mật khẩu để tránh đưa mật khẩu vào lịch sử lệnh:

```powershell
keytool -genkeypair -v -storetype JKS -keystore igen-upload.jks -alias igen-upload -keyalg RSA -keysize 2048 -validity 10000
```

Lưu keystore và mật khẩu trong kho bí mật của tổ chức, sao lưu độc lập với GitHub. Không commit khóa hoặc mật khẩu. Google Play App Signing quản lý app signing key dùng ký bản cài cho người dùng; CI dùng upload key để ký AAB gửi lên Play. [Ký ứng dụng Android](https://developer.android.com/studio/publish/app-signing)

Trong **repository mobile** trên GitHub, tạo environment `google-play` dưới Settings > Environments. Workflow checkout repository mobile tại root; đây là repository riêng với backend. Đặt variable dùng chung `EXPO_PUBLIC_API_URL` tại Settings > Secrets and variables > Actions > Variables của repository để cả workflow iOS và Android cùng đọc một URL. Nếu đã có variable này với URL production đúng thì dùng lại, không cần tạo `GOOGLE_PLAY_API_URL`. Không tạo bản trùng `EXPO_PUBLIC_API_URL` trong environment `google-play` nếu muốn hai nền tảng luôn dùng chung giá trị ở repository.

| Loại | Tên | Giá trị |
| --- | --- | --- |
| Repository variable dùng chung iOS/Android | `EXPO_PUBLIC_API_URL` | URL HTTPS backend production, không thêm `/api/v1`; không có fallback sang staging trong workflow AAB |
| Secret | `ANDROID_GOOGLE_SERVICES_JSON` | Nội dung JSON gốc của Firebase client config |
| Secret | `ANDROID_KEYSTORE_BASE64` | Upload keystore mã hóa Base64 |
| Secret | `ANDROID_KEYSTORE_PASSWORD` | Mật khẩu keystore |
| Secret | `ANDROID_KEY_ALIAS` | Alias khóa, ví dụ `igen-upload` |
| Secret | `ANDROID_KEY_PASSWORD` | Mật khẩu của khóa |

Workflow cũng nhận Firebase client config Base64 qua `ANDROID_GOOGLE_SERVICES_JSON_BASE64`, tương thích workflow APK đang có. Các secret Android có thể đặt ở repository hoặc environment `google-play`; Firebase config đã có ở repository có thể dùng lại nếu đúng package và project. Giữ URL dùng chung ở repository như trên; khóa ký Android tách riêng khỏi chứng chỉ/profile iOS. Tạo Base64 keystore bằng PowerShell, lưu vào file để dán vào Secret, rồi xóa file trung gian sau khi lưu an toàn:

```powershell
[IO.File]::WriteAllText((Join-Path $env:TEMP 'igen-upload.base64.txt'), [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\igen-upload.jks))))
```

## 2. Chạy workflow để tạo AAB

Sau khi commit/push các file build vào repository mobile, vào Actions > **Google Play AAB** > Run workflow. Nhập `version_code` là số nguyên dương không vượt `2100000000`, **lớn hơn mọi versionCode từng upload của ứng dụng**, kể cả các track thử nghiệm. Bản đầu có thể dùng `1` nếu package chưa có upload nào. Khi phát hành phiên bản hiển thị mới, sửa thêm `expo.version` trong `app.json`.

Workflow sẽ:

1. Cài Node 22, Java 17, Android SDK và dependency.
2. Khôi phục Firebase config và upload keystore từ Secrets.
3. Chạy typecheck, lint, tests build Android và preflight URL API/Firebase/versionCode/khóa ký.
4. Chạy `expo prebuild --platform android --clean --no-install`, cấu hình release signing bằng config plugin. Mật khẩu chỉ đọc từ environment khi Gradle chạy, không ghi vào mã native hay app config.
5. Chạy `app:bundleRelease`, kiểm tra JavaScript bundle nhúng, chữ ký JAR và certificate khớp upload key. Build thất bại nếu thiếu khóa, dùng certificate Android Debug hoặc chữ ký không hợp lệ.
6. Lưu AAB và R8 mapping thành hai Artifacts, dọn file khóa trên runner.

Tải artifact `igen-connect-google-play-<version_code>`, giải nén lấy `app-release.aab`. Artifact mapping dùng giải mã stack trace của bản release. Workflow **chỉ build**, bạn upload AAB trong Play Console ở bước tiếp theo. Workflow APK `android-test-apk.yml` vẫn phục vụ cài thử riêng; cấu hình AAB production dùng bốn ABI và packaging native hiện đại.

## 3. Build trên máy cá nhân khi cần

Máy phải có Node, JDK 17, Android SDK (platform/build-tools 36 và NDK tương ứng SDK 57), `ANDROID_HOME`/`ANDROID_SDK_ROOT` đúng. Gradle wrapper tự lấy phiên bản Gradle từ template Expo. Đặt API URL và `ANDROID_VERSION_CODE` trong `.env`, để `google-services.json` đúng package ở root hoặc đặt `GOOGLE_SERVICES_JSON` thành đường dẫn file. Cung cấp các biến ký sau bằng môi trường an toàn:

- `ANDROID_KEYSTORE_PATH`: đường dẫn tuyệt đối tới upload keystore.
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:android:play
npm run verify:play -- --signing
npm run build:android:play
```

Kết quả: `android/app/build/outputs/bundle/release/app-release.aab`. Lệnh build sinh lại thư mục Android bằng prebuild; lưu chỉnh sửa native trong app config/config plugins để chúng được tái tạo. Các thư mục native được ignore trong Git.

## 4. Upload và kiểm thử qua Google Play

Hoàn tất xác minh tài khoản tổ chức, website và số điện thoại trong Play Console. Tạo ứng dụng tương ứng package `com.igen.connect`, bật Play App Signing và upload AAB vào **Internal testing**. Hoàn tất bản phát hành thử, thêm tester rồi cài app từ link Google Play.

Kiểm tra đăng ký, duyệt/rời chapter, đổi tài khoản, refresh phiên sau 15 phút và kết nối lại socket. Kiểm tra camera QR, GPS, sinh trắc học, chat/đính kèm, push khi mở app/chạy nền/tắt app và xóa tài khoản trên thiết bị thật. Android lấy native FCM token và backend gửi FCM trực tiếp; không cần Expo Push Service hay EAS project.

Kiểm tra target API từ 36 trở lên, ABI và `versionCode` trong App Bundle Explorer. Chạy pre-launch report và kiểm tra thư viện native trên thiết bị/emulator 16 KB; cấu hình packaging chưa thay thế được kiểm thử native thực tế. [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [16 KB](https://developer.android.com/guide/practices/page-sizes)

## 5. Hoàn thiện hồ sơ và gửi duyệt production

Điền Data safety theo dữ liệu thật được thu thập, khai báo quyền vị trí/camera/micro/thông báo, content rating và đối tượng sử dụng. Kiểm tra luồng chặn/báo cáo nội dung chat theo chính sách UGC. Chuẩn bị tài khoản reviewer, icon, ảnh màn hình, feature graphic và thông tin hỗ trợ. Kiểm tra các trang public `/privacy-policy` và `/user-data-deletion` trên domain phát hành, bảo đảm có cách gửi yêu cầu xóa tài khoản ngoài app. Hoàn tất các yêu cầu trong Play Console rồi gửi duyệt production. [Yêu cầu xóa tài khoản](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

Tài khoản hiện tại là **Organization account**. Yêu cầu closed testing 12 tester liên tục 14 ngày được Google công bố cho tài khoản **cá nhân tạo sau 13/11/2023**; kiểm tra các yêu cầu cụ thể hiển thị trong Console của tổ chức. [Phạm vi yêu cầu testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

Thông tin cần cấu hình thực tế: URL API production, Firebase client config, upload keystore/mật khẩu và quyền GitHub/Play Console. Android giữ FCM trực tiếp; iOS giữ Expo Push Service và project ID/APNs credentials đã có, độc lập với build Android.
