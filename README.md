# remotion-reels-skills

Bộ **Agent Skills** để AI agent dựng video dọc 9:16 (Reels / TikTok) bằng Remotion. Repo không có app hay code để chạy. Mỗi thư mục trong `skills/` là một skill theo chuẩn [Agent Skills](https://agentskills.io) (`SKILL.md` + tài nguyên đi kèm). Agent nào đọc được skill (Claude Code, Codex, Cursor, Gemini CLI, …) cũng cài và dùng được.

## Các skill

| Skill | Làm gì |
| --- | --- |
| [`reels-templates`](skills/reels-templates/SKILL.md) | Dựng một video quảng cáo 9:16 từ footage, ảnh hoặc brief bằng 15 template có sẵn: chat story, notes list, search bar, lock-screen notifications, polaroid dump, ranking, poll, beat-cut, UGC captions, listicle, before/after, slideshow, testimonial, comment reply, sale promo. Render được nhiều ngôn ngữ. |
| `remotion-best-practices` (nên cài kèm, không có trong repo này) | Skill chính thức của Remotion, dùng làm tài liệu tham khảo khi viết code Remotion. Repo này không chứa skill đó. Cài từ [remotion-dev/skills](https://github.com/remotion-dev/skills) bằng `npx skills add remotion-dev/skills --skill remotion-best-practices`. |

## Dùng ngay trong repo này

Clone repo về và mở agent ngay trong thư mục repo:

```bash
git clone https://github.com/du-nguyen-IT007/remotion-reels-skills.git
cd remotion-reels-skills
npx skills add remotion-dev/skills --skill remotion-best-practices -a claude-code -y   # không bắt buộc: tài liệu Remotion
claude      # hoặc: codex, gemini
```

Repo có sẵn các symlink `.claude/skills` và `.agents/skills`, đều trỏ về `skills/`. Nhờ vậy Claude Code, Codex và Gemini CLI mở repo lên là nhận skill luôn. Lần đầu dùng, dán prompt sau cho agent:

```text
Chuẩn bị repo này để dựng video: đọc AGENTS.md và skill reels-templates, kiểm tra Node.js >= 18, ffmpeg, ffprobe (thiếu thì báo lệnh cài, không tự cài), tạo workspace reels/ theo mục "0. Set up the workspace" nếu chưa có, chạy `cd reels && npx tsc --noEmit && node clean.mjs --report`, rồi báo lại kết quả.
```

Sau đó cứ nói bình thường, ví dụ "dựng video reels từ footage trong ~/Downloads/ao-len, kiểu chat story, tiếng Anh và tiếng Nhật". Media, job và video nằm trong `reels/`. Thư mục này không đưa vào git, nên mỗi máy có workspace riêng.

## Cài sang dự án khác

Muốn dùng skill ở thư mục khác thì cài bằng [skills CLI](https://github.com/vercel-labs/skills). Lệnh này chạy được với mọi agent:

```bash
npx skills add du-nguyen-IT007/remotion-reels-skills
npx skills add remotion-dev/skills --skill remotion-best-practices   # nên cài kèm
```

CLI sẽ hỏi cài skill nào và cho agent nào. Thêm `-g` để cài cho toàn máy thay vì cho một dự án. Muốn cài thẳng cho một agent thì thêm `-a <agent> -s '*' -y`, ví dụ:

| Agent | Lệnh | Skill nằm ở |
| --- | --- | --- |
| Claude Code | `npx skills add <repo> -a claude-code -s '*' -y` | `.claude/skills/` |
| Codex | `npx skills add <repo> -a codex -s '*' -y` | `.agents/skills/` |
| Gemini CLI | `npx skills add <repo> -a gemini-cli -s '*' -y` | `.agents/skills/` |

Hoặc cài tay: copy từng thư mục trong `skills/` vào thư mục skill của agent bạn dùng (xem cột cuối của bảng trên).

### Nhờ agent tự cài

Mở agent trong thư mục sẽ dùng để làm video (một thư mục trống cũng được), dán prompt dưới đây vào, thay `<repo>` bằng `du-nguyen-IT007/remotion-reels-skills`:

```text
Cài bộ skill làm video Reels từ <repo> cho chính bạn (agent đang chạy), rồi chuẩn bị sẵn để dựng video:
1. Chạy `npx skills add <repo> -a <tên-agent-của-bạn> -s '*' -y` trong thư mục này. Không biết tên agent của mình thì chạy `npx skills add <repo> --list` và chọn đúng agent.
2. Kiểm tra Node.js >= 18, ffmpeg và ffprobe. Thiếu cái nào thì báo tôi lệnh cài cho máy này, không tự cài.
3. Đọc skill reels-templates vừa cài và làm theo mục "0. Set up the workspace": chép assets/reels-kit thành ./reels và chạy npm install.
4. Kiểm tra bằng lệnh `cd reels && npx tsc --noEmit` và `node clean.mjs --report`.
5. Báo lại: skill đã cài ở đâu, phiên bản Node và ffmpeg, workspace reels/ đã sẵn sàng chưa.
```

Có thể phải khởi động lại agent (hoặc mở phiên mới) thì agent mới nhận skill vừa cài.

## Dùng thế nào

Mở agent trong thư mục bạn muốn chứa video rồi nói với nó, ví dụ:

> Dựng video reels quảng cáo từ footage trong thư mục này, kiểu chat story, render tiếng Anh và tiếng Nhật.

Lần đầu, agent sẽ tạo thư mục `reels/` ngay trong thư mục đó (chép từ template kèm theo skill) rồi cài các package cần thiết. Mỗi job có thư mục media riêng: file đầu vào ở `reels/public/<job>/`, video xuất ra ở `reels/exports/<job>/`.

Máy cần có:

- Node.js 18 trở lên
- `ffmpeg` và `ffprobe`
- Kết nối mạng khi render (để tải Google Fonts)

Skill được viết cho agent chạy tự động, không cần người duyệt từng bước. Agent chỉ dừng lại khi gặp lỗi tự xử lý không được (thiếu công cụ, thiếu media, render lỗi mãi). Mỗi job kết thúc bằng một báo cáo gồm: đường dẫn video, các giá trị mặc định đã dùng, nguồn của từng file đầu vào, những gì đã dọn và dung lượng giải phóng được.

Media được quản lý theo từng job. File đầu vào nằm ở `reels/public/<job>/`, video xuất ra nằm ở `reels/exports/<job>/`. Sau mỗi job, agent tự chạy `node clean.mjs --auto --keep=<job>`. Lệnh này:

- xoá file tạm và ảnh kiểm tra;
- xoá media của các job không động tới quá `REELS_KEEP_DAYS` ngày (mặc định 30);
- nếu tổng dung lượng các job vượt `REELS_MAX_GB` GB (mặc định 20), xoá tiếp từ job cũ nhất. Xoá file đầu vào trước, video xuất ra sau cùng.

Lệnh này không đụng tới job đang làm, các job mới sửa trong 24 giờ, file job (`.json`) và các file nằm lẻ ngoài thư mục job. Mọi lần xoá media đều được ghi vào `reels/clean.log`. Muốn đổi ngưỡng thì đặt biến môi trường cho agent, ví dụ `REELS_KEEP_DAYS=14 REELS_MAX_GB=50`. Muốn xem dung lượng thì chạy `node clean.mjs --report`. Chi tiết ở mục 6 trong [SKILL.md](skills/reels-templates/SKILL.md).

Remotion có license riêng. Cá nhân và công ty từ 3 người trở xuống được dùng miễn phí, công ty lớn hơn phải mua [license công ty](https://www.remotion.dev/license).

## Cấu trúc repo

```
skills/
  reels-templates/
    SKILL.md              hướng dẫn cho agent
    assets/reels-kit/     dự án Remotion mẫu; agent chép nó sang reels/ khi dùng
```

`.claude/skills` và `.agents/skills` là symlink tới `skills/`, để Claude Code, Codex và Gemini CLI mở repo này lên là nhận skill luôn. `reels/` là workspace cục bộ, không đưa vào git.

## Bảo trì

- **Sửa hoặc thêm template:** làm trong `skills/reels-templates/assets/reels-kit/`. Thêm template mới thì cập nhật luôn bảng template trong `SKILL.md`.
- **Skill Remotion:** `skills/remotion-best-practices/` bị gitignore. Nếu bạn cài skill đó vào thư mục này để dùng ở máy mình, đừng commit nó: repo gốc của Remotion không có license cho phép phân phối lại.
- **Không đưa sở thích riêng vào skill:** sở thích của người dùng hoặc của brand (font, màu, giọng văn) không ghi vào skill hay template. Agent nhận các thông tin đó từ người dùng mỗi khi làm việc.

## License

[MIT](LICENSE) cho mọi thứ trong repo này. Phần mềm mà kit dùng tới, đặc biệt là [Remotion](https://www.remotion.dev/license), có license riêng.
