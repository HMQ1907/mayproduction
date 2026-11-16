# Mở Ô Bí Mật (Vue 3 + Supabase)

Web minigame chơi theo luật file "Luật chơi Minigame Mở Ô Bí Mật": mỗi tuần 1 chủ đề, 1 bộ câu hỏi, có bảng xếp hạng và top 3 đúng và nhanh nhất mỗi tuần.

- **Player** (`/`): nhập họ tên, mở 12/16 ô (câu hỏi, BONUS, BOOM), xem bảng xếp hạng (`/leaderboard`).
- **Admin** (`/admin`): đăng nhập, tạo tuần, import câu hỏi (.xlsx/.csv), cấu hình luật, bật/tắt tuần, xem/xóa/xuất kết quả.

## Cài đặt (làm 1 lần)

1. Tạo project tại https://supabase.com.
2. **SQL Editor** → dán toàn bộ `supabase/schema.sql` → Run.
3. Tài khoản admin nằm sẵn trong bảng `admin_users` (mặc định `may_group` / `123456`), đăng nhập tại `/admin/login`.
   Đổi mật khẩu bằng SQL Editor:
   ```sql
   update public.admin_users
   set password_hash = extensions.crypt('mat-khau-moi', extensions.gen_salt('bf'))
   where username = 'may_group';
   ```
   Thêm admin khác: `insert into public.admin_users values ('ten', extensions.crypt('mat-khau', extensions.gen_salt('bf')));`
4. Copy `.env.example` thành `.env`, điền URL và anon key (Project Settings > API).
5. Chạy:
   ```bash
   npm install
   npm run dev      # chạy thử
   npm run build    # build ra thư mục dist để deploy (Netlify/Vercel...)
   ```
   Khi deploy lên Netlify, nhớ khai báo 2 biến môi trường `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

## Quy trình mỗi tuần

1. `/admin` → **Tạo tuần mới** (tên, chủ đề, emoji hình ô, màu).
2. Tải **File mẫu**, điền câu hỏi, **Import** (cần tối thiểu 10 câu, nên 12 trở lên).
3. Quay lại danh sách → **Mở cho người chơi** (tuần cũ tự đóng, kết quả vẫn giữ để xem lại).
4. Chơi thử 1 lượt rồi **Xóa tất cả** kết quả thử ở mục 4 trước giờ chính thức.
5. Mở `/leaderboard` trên màn hình lớn (tự cập nhật mỗi 8 giây). Tab "Vinh danh các tuần" hiện top 3 của mọi tuần.

## Định dạng file câu hỏi

| Loại | Câu hỏi | Đáp án A | B | C | D | Đáp án đúng | Ảnh (link) |
|---|---|---|---|---|---|---|---|
| Trắc nghiệm | Thủ đô VN? | Hà Nội | Đà Nẵng | Huế | TP.HCM | A | |
| Nhập chữ | Đuổi hình bắt chữ | | | | | con mèo \| mèo | https://…/hinh.jpg |

- Câu nhập chữ: nhiều đáp án chấp nhận ngăn cách bằng `|`; không phân biệt hoa thường và dấu.
- Ảnh là link công khai (Supabase Storage public bucket, Imgur, Google Drive đã public…).
- Excel không đọc được "chữ đỏ", nên đáp án đúng ghi ở cột **Đáp án đúng**.

## Chống gian lận

- Người chơi **không đọc được** bảng câu hỏi: mọi thứ đi qua hàm RPC, đáp án đúng chỉ nằm trên server.
- Vị trí ô, bộ câu được bốc, thứ tự đáp án đều xáo ngẫu nhiên trên server mỗi lượt chơi.
- Giờ trả lời tính ở server (dư 3 giây cho độ trễ mạng); tải lại trang không được thêm thời gian.
- Chặn chơi lại theo **tên** (không phân biệt hoa thường, dấu) và theo **thiết bị** (mã lưu trong localStorage), mỗi tuần 1 lần. Người dùng xóa dữ liệu trình duyệt hoặc dùng trình duyệt ẩn danh vẫn lách được phần thiết bị, nhưng tên vẫn bị chặn.
- Admin có thể xóa kết quả vi phạm, người đó sẽ được chơi lại.
