# Phát hành iGen Connect lên Google Play

Ứng dụng dùng package `com.igen.connect`, version hiển thị lấy từ `app.json` (hiện là `1.0.0`). Workflow **Google Play AAB** build trực tiếp bằng Gradle trên GitHub Actions, ký bằng upload keystore của tổ chức, tự upload AAB/mapping vào **Internal testing** dưới dạng **draft**, đồng thời giữ bản sao trong Artifacts. Không dùng EAS Build, Expo Submit, tài khoản Expo, `EXPO_TOKEN` hay `EAS_PROJECT_ID`. Expo SDK vẫn là thư viện của app; Expo CLI chạy tại máy build để sinh Android project và đóng gói JavaScript. [Build Android trực tiếp](https://docs.expo.dev/guides/local-app-production/)

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
| Repository variable | `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` | Tên tài nguyên đầy đủ `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` |
| Repository variable | `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` | Email service account upload, ví dụ `github-play-upload@PROJECT_ID.iam.gserviceaccount.com` |

Workflow cũng nhận Firebase client config Base64 qua `ANDROID_GOOGLE_SERVICES_JSON_BASE64`, tương thích workflow APK đang có. Các secret Android có thể đặt ở repository hoặc environment `google-play`; Firebase config đã có ở repository có thể dùng lại nếu đúng package và project. Giữ URL dùng chung ở repository như trên; khóa ký Android tách riêng khỏi chứng chỉ/profile iOS. Tạo Base64 keystore bằng PowerShell, lưu vào file để dán vào Secret, rồi xóa file trung gian sau khi lưu an toàn:

```powershell
[IO.File]::WriteAllText((Join-Path $env:TEMP 'igen-upload.base64.txt'), [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\igen-upload.jks))))
```

### Cấp quyền upload không dùng service account key

Workflow dùng GitHub OIDC/Workload Identity Federation (WIF) để đổi danh tính workflow đã giới hạn theo repository và nhánh `production` lấy credential ngắn hạn. Cách này không tạo file JSON key dài hạn, không cần GitHub Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, và dùng được khi organization policy chặn tạo service account key. Việc cấu hình WIF cần quyền tạo pool/provider, bật API và cấp quyền impersonation; nếu không có các quyền đó, nhờ quản trị viên Cloud/org thực hiện các bước bên dưới. Không yêu cầu quản trị viên tắt policy cấm key.

1. Trong Google Cloud Console, dùng project quản lý CI có billing được bật và bật **Google Play Android Developer API** (`androidpublisher.googleapis.com`), **IAM API**, **Security Token Service API**, **Service Account Credentials API** và **Resource Manager API**. Nếu chưa được cấp quyền tạo pool/provider hoặc bật API, nhờ Cloud admin thực hiện; nếu policy của organization chặn GitHub issuer thì admin cần cho phép `https://token.actions.githubusercontent.com/`. Dùng service account `github-play-upload` đã tạo; không cần thêm role Owner/Editor cho tài khoản này. Ghi lại email đầy đủ của nó.
2. Vào **IAM & Admin > Workload Identity Federation > Create pool**. Tạo pool ID `github-actions`. Trong pool, thêm provider loại **OpenID Connect (OIDC)** với provider ID `bni-mobile-production`, issuer URL `https://token.actions.githubusercontent.com/` và audience mặc định.
3. Trong provider, đặt attribute mappings:

   ```text
   google.subject=assertion.sub
   attribute.repository=assertion.repository
   attribute.ref=assertion.ref
   ```

   Đặt attribute condition để chỉ workflow trong repository và nhánh production được xác thực:

   ```text
   attribute.repository == 'Chung2310/BNI-ERP-Mobile' && attribute.ref == 'refs/heads/production'
   ```

   Lưu provider. Sao chép **provider resource name** đầy đủ; nó có dạng `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/bni-mobile-production`. Dùng **project number**, không dùng project ID.
4. Cấp cho danh tính GitHub trong pool quyền **Workload Identity User** (`roles/iam.workloadIdentityUser`) trên service account `github-play-upload`. Trong phần cấp quyền của service account, chọn grant access bằng service account impersonation và giới hạn principal theo `attribute.repository = Chung2310/BNI-ERP-Mobile`. Condition ở provider đã giới hạn thêm nhánh production.
5. Trong Play Console > **Users and permissions > Invite new users**, mời email service account. Chỉ cấp cho app `com.igen.connect`: **View app information (read-only)** và **Release apps to testing tracks**. Không cấp quyền production hay tài chính.
6. Trong GitHub repository Settings > **Secrets and variables > Actions > Variables**, tạo:
   - `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` = provider resource name đã sao chép ở bước 3.
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` = email service account ở bước 1.

Hai giá trị này là **Variables**, không phải Secrets; không tạo `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. Các biến API/Firebase/keystore hiện có giữ nguyên. Workflow kiểm tra định dạng provider và email trước khi build, sau đó dùng action Google để tạo credential WIF tạm cho uploader; action dọn file credential sau job. Action auth và upload đều ghim theo commit cụ thể. Kiểm tra cấu hình không thay thế xác thực API/quyền thật trên Google Play.

[Google Play Developer API](https://developers.google.com/android-publisher/getting_started), [WIF cho deployment pipelines](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [quyền Play Console](https://support.google.com/googleplay/android-developer/answer/9844686?hl=en), [Google auth action](https://github.com/google-github-actions/auth), [upload action và WIF](https://github.com/r0adkll/upload-google-play/tree/e738b9dd8f2476ea806d921b64aacd24f34515a5).

App/package phải tồn tại trong Play Console và hoàn tất bước Play App Signing ban đầu. Nếu API báo **Package not found** ở lần đầu, kiểm tra quyền đúng app; nếu package chưa được Play nhận diện, upload AAB đầu tiên qua Console một lần rồi dùng CI cho các bản tiếp theo. Nếu Google báo **Only releases with status draft may be created on draft app**, workflow đã dùng `draft`; hoàn tất các bước setup app trong Console trước khi phát hành thử. Không chỉnh Console cùng lúc job đang upload để tránh xung đột edit.

## 2. Chạy workflow để build và upload AAB

Workflow **Google Play AAB** tự chạy khi push/merge lên nhánh `production`, giống workflow iOS. Merge vào `develop` không chạy build AAB. Khi cần chạy thủ công, vào Actions > **Google Play AAB** > Run workflow và chọn nhánh `production`; các nhánh khác bị bỏ qua.

Không cần nhập `version_code` hoặc tạo thêm variable: CI tự tính `ANDROID_VERSION_CODE = github.run_number * 100 + github.run_attempt`. Lần chạy đầu là `101`, lần chạy mới kế tiếp là `201`; chạy lại lần đầu tạo `102`. Mỗi lần chạy hỗ trợ tối đa 99 attempts. Version code phải lớn hơn mọi bản đã upload lên Play: dùng một lần chạy mới để phát hành bản tiếp theo, không chạy lại build cũ sau khi đã phát hành build mới hơn. Khi phát hành phiên bản hiển thị mới, sửa thêm `expo.version` trong `app.json`.

Workflow sẽ:

1. Cài Node 22, tự sinh version code, kiểm tra WIF provider/email, cài Java 17, Android SDK và dependency.
2. Khôi phục Firebase config và upload keystore từ Secrets.
3. Chạy typecheck, lint, tests build Android và preflight URL API/Firebase/versionCode/khóa ký.
4. Chạy `expo prebuild --platform android --clean --no-install`, cấu hình release signing bằng config plugin. Mật khẩu chỉ đọc từ environment khi Gradle chạy, không ghi vào mã native hay app config.
5. Chạy `app:bundleRelease`, kiểm tra JavaScript bundle nhúng, chữ ký JAR và certificate khớp upload key. Build thất bại nếu thiếu khóa, dùng certificate Android Debug hoặc chữ ký không hợp lệ.
6. Lưu AAB và R8 mapping thành hai Artifacts.
7. Lấy credential ngắn hạn qua GitHub OIDC rồi upload AAB và mapping vào **Internal testing**, trạng thái **draft**, với release name gồm version và versionCode. Dọn file khóa ký ở cuối job; action xác thực dọn file WIF của nó.

Build và upload thành công thì vào Play Console để xem bản nháp đã có sẵn, không cần tải AAB rồi upload lại. Hoàn tất tester/setup và phát hành bản nháp khi sẵn sàng; workflow không tự gửi duyệt/phát hành production. Artifact `igen-connect-google-play-<versionCode>` chứa `app-release.aab`; artifact mapping dùng giải mã stack trace và làm bản sao dự phòng khi cần. Cấu hình AAB production dùng bốn ABI và packaging native hiện đại.

Workflow APK tạm ngừng và được lưu tại `.github/disabled-workflows/android-test-apk.yml`, ngoài thư mục workflow hoạt động. Muốn bật lại, chuyển file đó về `.github/workflows/`. Bước setup Android của AAB chỉ cài `platform-tools`, tránh gói SDK `tools` mà runner không còn tìm được.

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

Hoàn tất xác minh tài khoản tổ chức, website và số điện thoại trong Play Console. Tạo ứng dụng tương ứng package `com.igen.connect`, bật Play App Signing, rồi mở bản **Internal testing draft** do workflow upload. Hoàn tất bản phát hành thử, thêm tester rồi cài app từ link Google Play.

Kiểm tra đăng ký, duyệt/rời chapter, đổi tài khoản, refresh phiên sau 15 phút và kết nối lại socket. Kiểm tra camera QR, GPS, sinh trắc học, chat/đính kèm, push khi mở app/chạy nền/tắt app và xóa tài khoản trên thiết bị thật. Android lấy native FCM token và backend gửi FCM trực tiếp; không cần Expo Push Service hay EAS project.

Kiểm tra target API từ 36 trở lên, ABI và `versionCode` trong App Bundle Explorer. Chạy pre-launch report và kiểm tra thư viện native trên thiết bị/emulator 16 KB; cấu hình packaging chưa thay thế được kiểm thử native thực tế. [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [16 KB](https://developer.android.com/guide/practices/page-sizes)

## 5. Hoàn thiện hồ sơ và gửi duyệt production

Điền Data safety theo dữ liệu thật được thu thập, khai báo quyền vị trí/camera/micro/thông báo, content rating và đối tượng sử dụng. Kiểm tra luồng chặn/báo cáo nội dung chat theo chính sách UGC. Chuẩn bị tài khoản reviewer, icon, ảnh màn hình, feature graphic và thông tin hỗ trợ. Kiểm tra các trang public `/privacy-policy` và `/user-data-deletion` trên domain phát hành, bảo đảm có cách gửi yêu cầu xóa tài khoản ngoài app. Hoàn tất các yêu cầu trong Play Console rồi gửi duyệt production. [Yêu cầu xóa tài khoản](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

Tài khoản hiện tại là **Organization account**. Yêu cầu closed testing 12 tester liên tục 14 ngày được Google công bố cho tài khoản **cá nhân tạo sau 13/11/2023**; kiểm tra các yêu cầu cụ thể hiển thị trong Console của tổ chức. [Phạm vi yêu cầu testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

Thông tin cần cấu hình thực tế: URL API production, Firebase client config, upload keystore/mật khẩu và quyền GitHub/Play Console. Android giữ FCM trực tiếp; iOS giữ Expo Push Service và project ID/APNs credentials đã có, độc lập với build Android.
