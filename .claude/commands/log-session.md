End-of-session log. Làm 3 việc theo thứ tự:

1. Đọc PROGRESS.md để biết format entry gần nhất.

2. Đọc `git log` từ commit cuối + diff files đã thay đổi trong session này.

3. Tạo entry mới ở TOP của PROGRESS.md với format:
   ## YYYY-MM-DD — <Phase/feature ngắn gọn>
   
   **Done:** 3-6 gạch đầu dòng (mức high-level, không file-by-file)
   **Lưu ý kỹ thuật:** chỉ ghi non-obvious (version pin, refactor lớn, circular dep...)
   **Tech debt phát sinh:** nếu có, đề xuất 1-3 entry cho BACKLOG.md
   **Next:** 1-2 dòng

4. ĐỢI tôi xác nhận trước khi append vào BACKLOG.md.

KHÔNG dùng emoji thừa. KHÔNG khen công việc. Đây là log kỹ thuật.