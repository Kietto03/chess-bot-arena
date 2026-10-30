# ♞ Chess Bot Arena

Mở [Chess Playing AI](https://chess-playing-ai.vercel.app/) cùng **menu Stockfish nổi ngay trên game**. Dùng Windows, macOS hoặc Linux; chọn cho hai bot đấu nhau hoặc nhập mã phòng để bot cầm Đen đấu online.

## Tải và bật

1. Cài **[Node.js 22 trở lên](https://nodejs.org/)** một lần (kèm npm).
2. Tải `chess-bot-arena-launchers.zip` từ **[Releases](https://github.com/Kietto03/chess-bot-arena/releases/latest)**, giải nén toàn bộ vào thư mục có quyền ghi.
3. Mở launcher tương ứng:

| Hệ điều hành | Cách chạy |
|---|---|
| Windows | Nhấp đúp `Start-Windows.cmd` |
| macOS | Nhấp đúp `Start-macOS.command` |
| Linux desktop | Trong terminal: `bash start-linux.sh` |

4. Chọn **1** để vào phòng online rồi nhập mã 6 ký tự hoặc link `?room=ABC123`; chọn **2** để xem hai bot đấu.

Lần đầu launcher tự chạy `npm ci` và tải Chromium đúng phiên bản. Những lần sau dùng lại thư viện và browser đã cài. Khi mã nguồn/lockfile đổi, launcher cài lại dependency. Cần Internet để tải game/Python/WASM. Đây là gói mã nguồn có launcher, **chưa phải ứng dụng độc lập chứa sẵn Node.js/browser**. Không cần cài Stockfish hệ thống.

Với macOS, nếu file chưa có quyền chạy: `chmod +x Start-macOS.command`, hoặc dùng `bash Start-macOS.command`. Trên Linux cần môi trường desktop; nếu thiếu thư viện Chromium, chạy `npx playwright install-deps chromium` trong thư mục repo (có thể cần quyền quản trị). Chi tiết: [Playwright browsers](https://playwright.dev/docs/browsers).

## Menu trong game

- **Bật / tạm dừng bot**; nước đang tính sẽ không được áp dụng nếu vừa tạm dừng.
- **Sức mạnh 0–20**, **thời gian suy nghĩ 100–3000 ms**; thay đổi được áp dụng cho lượt tính tiếp theo.
- Trạng thái, nước vừa đi và log 30 nước gần nhất.
- Kéo tiêu đề để di chuyển; nút **− / +** để thu gọn/mở rộng.

Online: host tạo phòng trong **Online Multiplayer → Host** rồi gửi mã/link. Bot tham gia với vai trò khách, cầm **Đen**; host cầm **Trắng**, đi trước. Bot đọc lại lịch sử khi tham gia ván đang chơi. Bot không tự chấp nhận đề nghị hòa/đi lại. Kết thúc ván online vẫn giữ cửa sổ để host bắt đầu ván mới. Hai bot local tự dừng khi kết thúc hoặc đạt giới hạn nước.

Menu chỉ hiện trong cửa sổ Chromium do launcher mở. Đóng cửa sổ hoặc Ctrl+C trong terminal để thoát. Giữ terminal mở trong lúc chơi. Các điều khiển menu không tác động đến bàn cờ; tránh tự đi quân cho bot khi bot đang chạy.

## Dùng terminal / phát triển

```sh
npm start                          # Launcher: cài dependency/browser, chọn chế độ
npm run setup                      # Chỉ cài dependency/browser
npm start -- --room=ABC123          # Mở phòng online ngay
npm start -- --local                # Mở hai bot + widget ngay
npm run online -- ABC123            # Online, bỏ bước setup
npm run arena                      # Hai bot, bỏ bước setup
npm run arena -- --white-skill=15 --black-skill=5 --think-ms=700 --delay-ms=1000 --max-plies=300
```

CLI local: `--headless` để chạy ẩn; `--max-plies` mặc định 300 nửa nước; `--delay-ms` mặc định 600 ms. Sức mạnh CLI riêng mỗi bên được giữ đến khi người dùng tương tác menu; sau đó menu đặt sức mạnh chung cho hai bot.

## Log và xem lại

Mỗi phiên tạo `runs/<UTC timestamp>/` (online thêm hậu tố `-online`):

| File | Nội dung |
|---|---|
| `events.jsonl` | Nước UCI/SAN/FEN, phản hồi engine, console và lỗi |
| `game.pgn` | Biên bản ván đấu |
| `latest.png` | Ảnh bàn cờ gần nhất |
| `video/*.webm` | Video, mở bằng trình duyệt hoặc VLC |
| `trace.zip` | Playwright trace |
| `error.png` | Ảnh lỗi nếu browser còn hoạt động |

```sh
npx playwright show-trace runs/<timestamp>/trace.zip
```

## Cách hoạt động và giới hạn

Game là Pygame/Pygbag trong canvas. Playwright chặn phản hồi `game.tar.gz` của phiên trình duyệt và thêm bridge Python xuất trạng thái chỉ đọc ra `window.__arena`. Local chọn Local 2-Player; online dùng kết nối phòng của game. Website công khai không bị sửa.

Stockfish nhận FEN từ chess.js, trả nước UCI; Playwright click ô xuất phát/đích và popup phong cấp. Runner kiểm tra bàn cờ với chess.js, không gọi `makeMove` để áp nước trực tiếp. Bridge phụ thuộc cấu trúc Python của trang; nếu thay đổi điểm chèn sẽ dừng và ghi `Game source changed`. Không tự đoán nước khi mất đồng bộ.

Bản đóng gói hỗ trợ nền tảng desktop được phiên bản Playwright trong lockfile hỗ trợ; không đảm bảo mọi bản Linux cũ. Log/video có thể chiếm nhiều dung lượng; xóa phiên cũ trong `runs/` khi cần. Gói phát hành không kèm dependency, game assets hoặc dữ liệu các ván của tác giả.

## Kiểm thử và phát hành

```sh
npm test
npm run test:widget
npm run smoke
```

Unit test chạy UCI Stockfish thực, kiểm tra nước hợp lệ, bridge và mã/link phòng. Widget test kiểm tra bật/tắt, slider, thu gọn và text an toàn trong Chromium. Smoke đi 8 nửa nước trên trang thật. GitHub Actions chạy unit + widget trên Windows, macOS và Ubuntu. Smoke trang thật chạy riêng để CI không phụ thuộc mạng của game. Chưa bao phủ tất cả tình huống phong cấp/nhập thành/bắt tốt qua đường trên giao diện.

Push tag `v*` sẽ tự tạo GitHub Release kèm ZIP và TAR.GZ chứa source + cả ba launcher. TAR.GZ giữ quyền executable khi giải nén trên macOS/Linux.

## Khắc phục sự cố

- **Không tìm thấy node:** cài Node.js rồi mở lại terminal/launcher.
- **Lỗi tải npm/Chromium/CDN:** kiểm tra Internet/proxy, thử lại; `npm run setup` để cài lại.
- **Linux thiếu thư viện:** `npx playwright install-deps chromium`.
- **Link không có phòng:** lấy link từ nút Copy link của game; `fbclid` là tham số Facebook, không phải mã phòng.
- **Game source changed / lệch bàn cờ:** xem `events.jsonl`; cần cập nhật adapter nếu trang thay đổi.

## Dependency

Stockfish là GPLv3; xem [mã nguồn và giấy phép stockfish.js](https://github.com/nmrugg/stockfish.js) khi phân phối lại engine. Gói launcher tải engine qua npm và không chứa bản sao engine binary/WASM hay assets của website.
