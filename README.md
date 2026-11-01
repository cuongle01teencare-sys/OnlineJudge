# Online Judge (lớp học)

Hệ thống chấm bài lập trình tự động cho lớp học:

- **Ngân hàng của giáo viên**: mỗi giáo viên có ngân hàng bài tập và đề riêng (đây là "bản thiết kế"). Giáo viên tự soạn bài hoặc **tải đề `.docx` / `.pdf`** lên; hệ thống tách đề thành từng bài để giáo viên duyệt lại và chọn độ khó. Mỗi bài có test và **đáp án** (lời giải thích + code).
- **Chia sẻ**: bài tập riêng tư theo mặc định. Có thể công khai riêng từng phần: đề bài, test ẩn, lời giải. Giáo viên khác xem và **lưu bản sao** về ngân hàng của mình (có ghi nguồn). Đề chỉ công khai được khi mọi bài trong đề đã công khai.
- **Phiên (giao bài)**: giáo viên tạo một phiên từ một đề hoặc một bài, giao cho một lớp hoặc **công khai** cho mọi người, có thời gian mở/đóng tùy chọn. Phiên chụp lại nội dung bài lúc tạo, nên sửa ngân hàng không làm đổi đề đang làm. Bài nộp, điểm và trạng thái "đã giải" thuộc về từng phiên.
- **Lớp**: mỗi lớp có một giáo viên phụ trách, nhiều học sinh và mã lớp riêng (ví dụ `22DTHC5`). Học sinh có thể học **nhiều lớp cùng lúc** hoặc không thuộc lớp nào (thí sinh tự do, làm các phiên công khai và luyện tập). Học sinh muốn vào hay rời lớp phải **gửi yêu cầu** để giáo viên duyệt; giáo viên được chủ động thêm học sinh bằng email hoặc mời ra khỏi lớp. Các lớp đã rời là lịch sử. Khi kết thúc khóa, giáo viên **lưu trữ** lớp: lớp chỉ còn đọc, học sinh vẫn xem lại được. Lớp đã lưu trữ có thể khôi phục, hẹn **xóa hẳn** sau N ngày, hoặc xóa ngay (phải gõ tên lớp để xác nhận).
- **Chế độ thi** (cài đặt cho từng phiên):
  - Thời gian làm bài riêng cho từng học sinh: bấm "Bắt đầu làm bài" thì đồng hồ mới chạy, và chỉ khi đó mới thấy đề. Hết giờ là khóa nộp; server kiểm tra theo giờ của server.
  - Đồng hồ đếm ngược có thông báo kèm âm thanh khi còn 15, 5, 1 phút và khi hết giờ.
  - Giới hạn ngôn ngữ, giới hạn số lần nộp mỗi bài.
  - Hiển thị kết quả cho học sinh: đầy đủ, chỉ điểm, hoặc ẩn đến khi phiên đóng. Giáo viên luôn thấy đầy đủ.
  - **Chấm lại** cả phiên hoặc một bài, và "Cập nhật đề từ ngân hàng & chấm lại" khi đã sửa test. Điểm và học bạ được tính lại theo kết quả mới.
- **Đọc đề bằng AI** (khi có `ANTHROPIC_API_KEY`): Claude đọc thẳng file PDF (kể cả bố cục lộn xộn hoặc bản scan) hoặc nội dung Word để tách bài. Không có key hoặc AI lỗi thì dùng bộ đọc theo mẫu.
  Hệ thống chấm chỉ dùng đầu vào/đầu ra chuẩn. Đề kiểu "đọc từ file BAI1.INP, ghi ra file BAI1.OUT" vẫn giữ nguyên câu chữ của giáo viên, nhưng không lưu được cho tới khi sửa: cạnh mỗi mục (Đề bài, Dữ liệu vào, Kết quả, Ràng buộc) có nút **Dùng gợi ý** để chuyển sang câu đọc từ đầu vào chuẩn/in ra màn hình, tắt đi là quay lại nội dung gốc. Lưu ý của AI về đọc/ghi file được bỏ.
- **Gợi ý test bằng AI**: ở tab Test của bài, bấm *Gợi ý bằng AI*. Claude đọc đề, các test hiện có và lời giải mẫu, đề xuất test biên/đặc biệt, rồi **chạy code** trong sandbox của Anthropic để tính output. Giáo viên xem, sửa và chọn test nào để thêm; test có output do AI tự tính (không chạy được code) được đánh dấu để kiểm tra lại.
- **Kiểm tra liêm chính** (hai công tắc riêng cho mỗi phiên, chỉ giáo viên thấy, không bao giờ đổi điểm):
  - *Đạo văn*: so "vân tay" code giữa các học sinh cùng phiên, bỏ qua tên biến, chú thích và định dạng (cùng ý tưởng với MOSS). Không cần AI.
  - *Dùng AI*: Claude đánh giá thận trọng từng bài nộp, chỉ ra đoạn code đáng ngờ kèm lý do.
  - Giáo viên mở ra so sánh code hai bên hoặc xem các dòng được đánh dấu, rồi tùy ý bấm "Đã xem".
- **Bảng tin lớp**: giáo viên đăng thông báo (ghim được); học sinh hỏi đáp, có thể gắn câu hỏi với một bài trong phiên. Lớp đã lưu trữ thì bảng tin chỉ còn đọc.
- **Học bạ**: học sinh thấy mình đã giải bài nào và hoàn thành đề nào, trong lớp nào. Học bạ vẫn còn sau khi lớp bị xóa hẳn (khi đó chỉ không mở lại được đề), và học sinh vẫn giữ code mình đã nộp.
- **Đăng ký**: học sinh tự đăng ký và xác thực **email bằng mã OTP**; mã lớp không bắt buộc (nhập thì gửi luôn yêu cầu vào lớp đó). Giáo viên được admin **mời qua email** và tự đặt mật khẩu. Có chức năng quên mật khẩu.
- **Admin** (duy nhất một tài khoản): quản lý tài khoản, xem được mọi ngân hàng và mọi lớp.
- Chấm tự động C, C++, Python, Java, JavaScript; bảng điểm theo phiên; in đề và in đáp án từ ngân hàng.

## Kiến trúc

pnpm monorepo:

| Thư mục | Package | Vai trò |
|---|---|---|
| `src/shared` | `@oj/contracts` | Kiểu dữ liệu dùng chung: DTO của API, enum, message của hàng đợi chấm |
| `src/backend` | `@oj/backend` | NestJS REST API, tổ chức theo DDD |
| `src/engine` | `@oj/engine` | Worker chấm bài: lấy job từ Redis, chạy code trong sandbox Docker |
| `src/frontend` | `@oj/frontend` | Next.js, deploy lên Vercel |

```
 Next.js (Vercel) ──HTTP──▶ NestJS API ──▶ PostgreSQL
                               │  ▲
                   judge-jobs  ▼  │ judge-results       (BullMQ / Redis)
                            Engine worker × N ──▶ docker run oj-runner (no network, giới hạn CPU/RAM/PID)
```

### Backend: bounded contexts (DDD)

Mỗi context nằm trong `src/backend/src/modules/<context>` và chia lớp `domain / application / infrastructure / presentation`:

- **identity**: aggregate `User` và `Verification` (OTP email, lời mời giáo viên). Bất biến "đúng một admin" được đảm bảo ở hai nơi: domain không có cách nào tạo ADMIN ngoài `bootstrapAdmin` khi khởi động, và database có partial unique index. Phát event `student-registered`, `user-deleted`.
- **classroom**: aggregate `Classroom` (mã lớp, giáo viên, vòng đời ACTIVE → ARCHIVED → xóa hẳn, có hẹn giờ), `Enrollment` (lớp của học sinh, có thể nhiều lớp cùng lúc, lớp đã rời là lịch sử) và `MembershipRequest` (yêu cầu vào/rời lớp chờ giáo viên duyệt). Phát event `class-purged`.
- **catalog**: ngân hàng bài tập. Aggregate `Problem` (chủ sở hữu, mức chia sẻ `Sharing`, các `TestCase`, `Solution`, nguồn sao chép). Phát event `problem-deleted`.
- **importing**: domain service `ExamParser` (heuristic cho đề tiếng Việt/Anh), port `DocumentReader` (mammoth cho docx, unpdf cho pdf). Bài nhập vào ngân hàng của người nhập.
- **assessment**: aggregate `ProblemSet` (đề trong ngân hàng) và `Session` (phiên: bản chụp các bài + thời gian mở/đóng, thuộc một lớp hoặc công khai). Projection **học bạ** (`learning_sessions`, `learning_progress`) được cập nhật từ event `submission-judged` và tồn tại độc lập với phiên và lớp.
- **integrity**: aggregate `IntegrityFlag` (gợi ý cần xem lại), domain service vân tay code (`fingerprint.ts`), port `AiUsageReviewer` (Claude). Nghe event `submission-judged` và chạy kiểm tra ở nền, không làm chậm việc chấm.
- **community**: aggregate `Thread` (thông báo / hỏi đáp kèm các trả lời). Quyền đăng bài do lớp quyết định; nghe `class-purged`.
- **judging**: aggregate `Submission` (gắn với phiên + bài, PENDING → JUDGING → DONE), port `JudgeQueue` (BullMQ). Hỏi assessment xem ai được nộp; phát event `submission-judged`.

Chiều phụ thuộc giữa các context: `integrity → judging → assessment → catalog, classroom → identity`, `community → assessment, classroom`. Không có vòng lặp: các phản ứng ngược chiều đi qua event (published language trong các file `*.events.ts`). Mỗi context dùng facade đã công bố của context khác qua port/adapter riêng (anti-corruption layer). Repository là abstract class trong domain; phần cài đặt bằng TypeORM nằm ở infrastructure.

### Hàng đợi chấm

- Backend chỉ đẩy job vào Redis. Job tự chứa đủ dữ liệu (code, giới hạn, test case) nên engine không cần truy cập DB.
- Có thể chạy nhiều engine song song (`JUDGE_CONCURRENCY` cho mỗi engine). BullMQ lo việc phân phối, retry và giữ job khi engine khởi động lại.
- Mỗi học sinh có tối đa `MAX_PENDING_SUBMISSIONS` bài đang chờ chấm, để một người không làm nghẽn hàng đợi.
- Sandbox: mỗi bài nộp chạy trong một container `oj-runner` riêng với `--network none`, giới hạn bộ nhớ, `--pids-limit`, user `nobody`. Thời gian (CPU) và bộ nhớ đỉnh được đo bằng GNU time.

## Chạy trên máy (development)

Yêu cầu: Node 24, pnpm, Docker Desktop.

```bash
pnpm install
```

```bash
pnpm build:shared
```

```bash
pnpm infra:up
```

```bash
pnpm runner:build
```

```bash
cp src/backend/.env.example src/backend/.env
```

Sau đó chạy mỗi lệnh dưới đây trong một terminal riêng:

```bash
pnpm dev:backend
```

```bash
pnpm dev:engine
```

```bash
pnpm dev:frontend
```

- API: http://localhost:4000/api. Frontend: http://localhost:3000
- Admin mặc định lấy từ `.env`: `admin@oj.local` / `admin12345`. **Hãy đổi trước khi dùng thật.**
- Gửi email: khi để trống `SMTP_HOST`, email (mã OTP, link mời) **được in ra log của backend** thay vì gửi thật. Để gửi bằng Gmail, bạn cần bật xác minh 2 bước cho tài khoản Gmail, tạo **App Password**, rồi đặt `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<gmail>` và `SMTP_PASS=<app password>`. Gmail giới hạn khoảng 500 email/ngày, đủ cho một lớp học.
- AI: đặt `ANTHROPIC_API_KEY` trong `src/backend/.env`. Model chọn riêng cho từng việc: `CLAUDE_MODEL` cho đọc đề (mặc định `claude-sonnet-5-5`), `CLAUDE_TESTGEN_MODEL` cho gợi ý test (mặc định bằng `CLAUDE_MODEL`) và `CLAUDE_REVIEW_MODEL` cho kiểm tra dùng AI (mặc định `claude-haiku-5-5`, rẻ vì chạy trên từng bài nộp). Khi để trống key, đọc đề dùng bộ đọc theo mẫu và bỏ qua kiểm tra dùng AI. Với Sonnet/Opus, lệnh gọi bật sẵn *refusal fallback* phía server (`fallbacks: "default"`); Haiku không hỗ trợ nên không gửi tham số này.
- Giáo viên tạo lớp và đặt mã lớp ở trang **Lớp**. Học sinh dùng mã đó để xin vào lớp (khi đăng ký hoặc ở trang **Lớp của tôi**), rồi giáo viên duyệt ở trang lớp.
- Không có Docker? Có thể chạy engine với `SANDBOX=local`: code chạy thẳng trên máy, **không cách ly**, chỉ dùng để thử.

Kiểm thử:

```bash
pnpm test
```

## Triển khai

- **Frontend → Vercel**: Root Directory `src/frontend`, đặt biến môi trường `NEXT_PUBLIC_API_URL=https://<api-domain>/api`. Chi tiết xem `src/frontend/README.md`.
- **Backend + engine + Postgres + Redis**: chạy trên một máy chủ/VPS có Docker. Engine cần quyền gọi `docker` để tạo sandbox. Trong production đặt `DB_SYNC=false`, `JWT_SECRET` ngẫu nhiên, và đặt `CORS_ORIGINS` là domain Vercel.

## Tài liệu

- REST API: [docs/API.md](docs/API.md)
- Thiết kế giao diện: [src/frontend/DESIGN.md](src/frontend/DESIGN.md)
