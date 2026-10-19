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

Mã ứng dụng nằm trong `src/app`. Ứng dụng đã kết nối các API BNI-ERP cho đăng nhập/refresh phiên, cuộc họp, QR/GPS check-in, điều hành và quay chọn người, thành viên, chat, thông báo, tài nguyên và phân quyền. Bảng xếp hạng được tổng hợp từ lịch sử check-in/phát biểu của cuộc họp.

Camera, vị trí và Face ID cần kiểm thử bằng development build trên thiết bị thật trước khi phát hành. Chạy `npx expo run:android` hoặc `npx expo run:ios` sau khi môi trường native đã được cài đặt.

## Thông báo đẩy trên iPhone

iOS hiện dùng Expo Push Service để chuyển thông báo tới APNs; Android tiếp tục dùng FCM trực tiếp. Thay đổi runner build không thay đổi dịch vụ gửi push: project ID Expo Push vẫn nằm trong `app.json` tại `expo.extra.eas.projectId`, và APNs key cần được cấu hình trong Expo Push Service. Provisioning profile dùng cho GitHub Actions phải có entitlement push production. Muốn bỏ cả Expo Push Service thì cần chuyển riêng luồng đăng ký token và gửi push sang APNs trực tiếp.

Thông báo có tiêu đề và nội dung xuất hiện trong Notification Center khi app ở nền hoặc đã đóng. app.json bật nhận thông báo nền; iOS quyết định việc chạy JavaScript âm thầm và không đảm bảo luôn chạy.

## CI/CD iOS lên App Store Connect

Workflow [iOS App Store build and upload](.github/workflows/ios-app-store.yml) chạy trên GitHub-hosted macOS 26 khi push lên nhánh `production` hoặc chạy thủ công trên nhánh đó. Workflow dùng Expo SDK/config plugins tại chỗ để sinh project native iOS, cài CocoaPods, archive/export bằng Xcode và tải IPA lên App Store Connect/TestFlight. Workflow không gọi EAS Build/Submit, không cần `EXPO_TOKEN`, và không tự gửi bản lên App Review.

Thiết lập trong GitHub repository, tại **Settings → Secrets and variables → Actions**.

Variables:

- `EXPO_PUBLIC_API_URL`: API production dạng HTTPS.
- `IOS_TEAM_ID`: Apple Developer Team ID gồm 10 ký tự.
- `IOS_BUILD_NUMBER_BASE`: build number cao nhất đã tải lên App Store Connect. Workflow cộng số lần chạy GitHub vào giá trị này để tạo build number mới.
- `ASC_API_KEY_ID` và `ASC_API_KEY_ISSUER_ID`: thông tin App Store Connect API key.

Secrets:

- `IOS_DISTRIBUTION_CERTIFICATE_BASE64`: certificate Apple Distribution dạng P12, đã mã hóa Base64.
- `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`: mật khẩu P12.
- `IOS_APP_STORE_PROFILE_BASE64`: App Store provisioning profile cho bundle ID `com.igen.bni`, đã mã hóa Base64 và có entitlement push production.
- `ASC_API_KEY_P8`: toàn bộ nội dung file App Store Connect `.p8`.

Dùng PowerShell để mã hóa certificate và profile thành Base64. Chạy từng lệnh riêng và dán clipboard sau mỗi lệnh vào GitHub Secret tương ứng:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\ios_distribution.p12")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\ios_app_store.mobileprovision")) | Set-Clipboard
```

Certificate P12 phải chứa Apple Distribution certificate cùng private key tương ứng; provisioning profile phải thuộc cùng Apple Developer Team và có App ID `com.igen.bni`. Không đưa các file này hoặc `.p8` vào repository. Đặt `IOS_BUILD_NUMBER_BASE` bằng build TestFlight/App Store gần nhất trước khi chạy workflow lần đầu.

Workflow lưu file IPA làm GitHub Actions artifact và tải một bản lên App Store Connect. Chờ Apple xử lý xong rồi chọn build đó trong phiên bản App Store Connect; bước upload không tự gửi App Review.

## Hồ sơ gửi App Review

Bộ nội dung chuẩn bị cho phiên bản 1.0.0 nằm trong [app-store](app-store/):

- [Các bước gửi duyệt và mục chủ app cần hoàn tất](app-store/submission-steps.vi.txt).
- [Tên, mô tả, từ khóa và URL để điền App Store Connect](app-store/listing.vi-VN.json).
- [Ghi chú tiếng Anh cho reviewer](app-store/review-notes.en.txt): đã điền các thông tin xác nhận, điền mật khẩu trực tiếp vào App Store Connect. Thông tin cuộc họp/QR cụ thể cần dữ liệu thực từ chủ app nếu bổ sung hướng dẫn check-in cho reviewer.
- [Bản đối chiếu App Privacy theo source](app-store/privacy-declaration.vi.txt): xác nhận cách vận hành thực tế rồi publish nhãn trên App Store Connect.

Các file này dùng để nhập thủ công trên App Store Connect. Sửa mô tả, từ khóa hoặc ghi chú reviewer không yêu cầu sửa mã nguồn hoặc build lại app. Chủ app xác nhận đã có bản TestFlight, tài khoản demo và dịch vụ miễn phí toàn bộ. Điền thông tin liên hệ, copyright và ảnh chụp thực; chọn build đã xử lý xong rồi thực hiện **Add for Review → Submit for Review** trong App Store Connect. Support URL có thể dùng trang chính sách công khai hiện có chứa thông tin liên hệ hỗ trợ; không cần tạo route mới cho bộ metadata này.

## Kiểm duyệt nội dung

Triển khai backend cùng phiên bản trước khi phát hành mobile. Người dùng nhấn giữ tin nhắn để báo cáo/chặn, chọn Báo cáo hồ sơ hoặc ảnh trong hồ sơ thành viên, hoặc bấm cờ cạnh tài nguyên của người khác. Báo cáo được lưu trong MongoDB; chặn áp dụng cả chat riêng và nhóm chung, gồm lịch sử, tìm kiếm, nội dung trích dẫn và push. Cài đặt → An toàn nội dung cho phép bỏ chặn và mở hàng đợi kiểm duyệt.

Tệp chat mới, ảnh đại diện/ảnh bìa/gallery mới, tài nguyên tải trực tiếp và link tài nguyên mới chờ duyệt trước khi chia sẻ. Người gửi thấy bản xem trước và nhãn chờ duyệt; người khác tiếp tục thấy ảnh hồ sơ đã được duyệt. Tài liệu Google Drive đã kết nối do người có quyền của Chapter quản lý tại nguồn. Quản trị viên Chapter hoặc tài khoản có quyền `chat:manage` xử lý tại Cài đặt → An toàn nội dung → Hàng đợi kiểm duyệt: duyệt, gỡ hoặc đình chỉ thành viên. Không cho đình chỉ admin/superadmin từ màn hình này. Nội dung bị gỡ do kiểm duyệt không thể khôi phục từ Thùng rác. Báo cáo đã đóng hết hạn sau 30 ngày; xóa tài khoản gỡ các báo cáo liên quan và tệp được sở hữu, gồm tệp đang chờ duyệt.

Bộ lọc văn bản chỉ chặn một số mẫu vi phạm rõ ràng; không thay thế người kiểm duyệt. Phải phân công người trực kiểm tra hàng đợi, xử lý báo cáo kịp thời và theo dõi hộp thư `igen.work99@gmail.com`. Quy tắc cộng đồng có sẵn trước đăng ký và trong Cài đặt. Chính sách riêng tư phải được triển khai trên website cùng bản mobile.

## Trước khi gửi App Review

Đối chiếu [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), đặc biệt 1.2, 2.1, 2.5.4 và 5.1.1. Các kiểm tra tự động không xác nhận app chắc chắn được Apple duyệt.

- Backend HTTPS phải hoạt động; kiểm tra luồng mới trên môi trường release sau khi deploy.
- Cung cấp tài khoản review đã được duyệt vào Chapter, một tài khoản admin kiểm duyệt và tài khoản dùng thử có thể xóa. Nhập mật khẩu trong App Store Connect, không commit vào Git.
- Ghi rõ đường đi kiểm tra: đăng nhập → Cài đặt → An toàn nội dung; chat → nhấn giữ tin nhắn → Báo cáo/Chặn; hồ sơ thành viên → Báo cáo hồ sơ hoặc ảnh; tài nguyên → biểu tượng cờ; Cài đặt → Quản lý tài khoản → Xóa tài khoản và dữ liệu. Admin chọn người nhận quyền; yêu cầu xóa tồn tại bền vững và tự thử lại khi dịch vụ lưu trữ gặp lỗi. Theo dõi bằng mã riêng, không cần email.
- Chuẩn bị cuộc họp mẫu, QR hợp lệ và hướng dẫn check-in GPS để reviewer thực hiện được ngoài văn phòng. Dùng điều kiện cuộc họp hợp lệ có sẵn; không thêm tài khoản ẩn hay bỏ qua xác thực.
- Giải thích vòng quay chỉ chọn người/thứ tự trong cuộc họp, không có vé, tiền cược hoặc phần thưởng. Kiểm tra mô tả và ảnh chụp không gọi là quay thưởng.
- Khai báo App Privacy dựa trên dữ liệu thực tế: thông tin liên hệ/hồ sơ, định danh tài khoản và push, GPS check-in, tin nhắn, ảnh/video/ghi âm/tệp, báo cáo/chặn; thêm thông tin tài chính hoặc dữ liệu sử dụng/chẩn đoán nếu backend thực tế lưu các dữ liệu đó. Chọn mục đích và liên kết danh tính đúng; không khai “Data Not Collected”. Face ID trả kết quả xác thực, không thu mẫu sinh trắc học. Không khai tracking nếu không có theo dõi liên ứng dụng/quảng cáo.
- Hoàn tất câu hỏi độ tuổi có chat/UGC; Privacy Policy URL, Support URL, thông tin liên hệ reviewer, export compliance và ảnh chụp đúng giao diện iPhone/iPad. App đang bật hỗ trợ tablet.
- Trên iPhone thật, kiểm tra cho phép/từ chối từng quyền, Face ID, mở lại sau đăng xuất, push khi mở/nền/đóng và chạm push khi chưa đăng nhập; trên iPad kiểm tra layout, xoay và bàn phím. Push nền do iOS quyết định; background JavaScript không được bảo đảm khi force quit.
- Kiểm tra EAS build log dùng Xcode/iOS SDK đáp ứng yêu cầu Apple hiện hành. Profile iOS dùng image `latest`; phải xem image thực tế trong log. Kiểm tra privacy manifest/required reasons trong archive và xử lý mọi cảnh báo App Store Connect. App config khai lý do API lấy từ manifest của React Native và Expo FileSystem; dữ liệu App Privacy vẫn phải khai riêng.
- Chờ App Store Connect xử lý `.ipa`, chọn build trong phiên bản và bấm Submit for Review. EAS Submit chỉ tải build lên, không tự gửi xét duyệt.
