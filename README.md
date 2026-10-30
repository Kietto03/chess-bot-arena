# Chess Bot Arena

Hai tiến trình **Stockfish 19** đánh với nhau trên https://chess-playing-ai.vercel.app/ bằng **Playwright**. Mặc định mở Chromium để xem trực tiếp; mỗi lượt có khoảng nghỉ để theo dõi.

## Chạy nhanh

Yêu cầu Node.js 22+ và kết nối Internet (game tải Python/WASM từ CDN).

```sh
npm ci
npx playwright install chromium
npm start
```

Điều chỉnh sức mạnh và tốc độ:

```sh
npm start -- --white-skill=15 --black-skill=5 --think-ms=700 --delay-ms=1000 --max-plies=300
```

- `white-skill`, `black-skill`: 0–20, mặc định 10.
- `think-ms`: thời gian suy nghĩ mỗi nước, mặc định 500 ms.
- `delay-ms`: khoảng nghỉ sau nước đi, mặc định 600 ms.
- `max-plies`: giới hạn số nửa nước, mặc định 300. Kết quả `*` nếu dừng trước khi kết thúc.
- `--headless`: chạy không mở cửa sổ; vẫn lưu video.
- `Ctrl+C`: dừng sau lượt hiện tại, hoàn tất log/video.

Giữ bàn cờ cho bot điều khiển khi đang chạy; thao tác tay làm thay đổi ván đấu sẽ khiến kiểm tra đồng bộ dừng bot.

## Log và xem lại

Mỗi lần chạy tạo `runs/<UTC timestamp>/`:

| File | Nội dung |
|---|---|
| `events.jsonl` | Sự kiện khởi động, từng nước UCI/SAN/FEN, toàn bộ phản hồi UCI của hai engine, console trang và lỗi |
| `game.pgn` | Biên bản cập nhật sau mỗi nước đã được xác nhận |
| `latest.png` | Ảnh bàn cờ gần nhất |
| `video/*.webm` | Video phiên trình duyệt, mở bằng trình duyệt hoặc VLC |
| `trace.zip` | Playwright trace: screenshot, DOM và thao tác |
| `error.png` | Ảnh khi gặp lỗi nếu trình duyệt còn hoạt động |

```sh
npx playwright show-trace runs/<timestamp>/trace.zip
```

## Cách hoạt động

Trang đích là Pygame/Pygbag chạy trong canvas, không có DOM cho từng quân cờ. Runner chặn phản hồi `game.tar.gz` trong phiên Chromium, thêm đoạn Python xuất **trạng thái chỉ đọc** ra `window.__arena`, chọn sẵn **Local 2-Player** và đặt hai bên thành người chơi để tránh AI có sẵn tranh lượt. Thay đổi này chỉ tồn tại trong phiên trình duyệt.

Hai Stockfish riêng biệt nhận FEN từ chess.js và trả nước UCI. Playwright click ô xuất phát/đích theo kích thước canvas thực tế, xử lý lựa chọn phong cấp, rồi đối chiếu toàn bộ bàn cờ với chess.js trước khi xác nhận và lưu nước đi. Không gọi `makeMove` để áp nước trực tiếp vào game.

Bridge phụ thuộc cấu trúc Python của trang. Nếu tác giả đổi các điểm chèn, chương trình báo `Game source changed` trong log và dừng. Không tự đoán nước khi mất đồng bộ. Chưa có cơ chế tiếp tục ván bị gián đoạn.

## Kiểm thử

```sh
npm test
npm run smoke
```

`npm test` kiểm tra UCI thực tế của Stockfish, nước hợp lệ và lỗi bridge khi nguồn không tương thích. `npm run smoke` chạy 8 nửa nước trên trang thật, tạo đủ log/PGN/video/trace. Đã chạy thành công ngày 30/10/2026; ảnh bàn cờ đã được kiểm tra. Kiểm thử ngắn này chưa bao phủ một ván hoàn chỉnh hoặc tất cả tình huống phong cấp/nhập thành/bắt tốt qua đường trên giao diện.

## Dependency

Stockfish được tải từ gói npm, không cần cài binary hệ thống. Stockfish là GPLv3; xem giấy phép và mã nguồn tại https://github.com/nmrugg/stockfish.js nếu phân phối lại engine. Repo không chứa bản sao mã nguồn/assets của trang đích; gói game được tải lúc chạy.
