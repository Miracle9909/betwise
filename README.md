# BetWise — Betting Strategy Optimizer 🎯

> Tối ưu chiến thuật cá cược Esports với Kelly Criterion & quản lý vốn thông minh

![BetWise Dashboard](https://img.shields.io/badge/Status-Live-00E676?style=for-the-badge)
![Tech](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20JS-57bcff?style=for-the-badge)

## 🚀 Demo

Mở `index.html` trực tiếp trong browser hoặc deploy lên GitHub Pages.

## ✨ Tính năng

### 📊 Dashboard
- Hiển thị số vốn hiện tại với % lãi/lỗ
- **Oracle** — Gợi ý lệnh tiếp theo dựa trên Kelly Criterion
- Chuỗi thắng/thua (streak dots) 
- Stats: Tỷ lệ thắng, Tổng lệnh, ROI, P&L

### ➕ Vào lệnh mới
- Gợi ý từ hệ thống (Kelly-calculated)
- Quick amount buttons (3%, 5%, 8%, 10% vốn)
- Confidence selector (1-5 sao)
- Cảnh báo rủi ro khi vượt ngưỡng
- Preview lãi/lỗ tiềm năng

### 📈 Lịch sử & Phân tích
- Danh sách lệnh với timestamp, odds, confidence
- Biểu đồ vốn theo thời gian (Canvas chart)
- Xuất dữ liệu JSON

## 🧠 Thuật toán

| Algorithm | Mô tả |
|-----------|-------|
| **Kelly Criterion** | Tính % cược tối ưu: `f* = (b*p - q) / b` |
| **Expected Value** | `EV = WR × Odds - (1-WR) × 1` |
| **Streak Analyzer** | Phát hiện chuỗi thắng/thua liên tiếp |
| **Risk Assessor** | Đánh giá rủi ro đa yếu tố → LOW/MEDIUM/HIGH/BLOCKED |
| **Stage Detection** | Tự động xác định giai đoạn (GĐ1-4) theo vốn |
| **Bankroll Protector** | Stop-loss 3 tầng (session/daily/weekly) |

## 🎨 Design System — "BetWise Onyx"

- **Background**: Deep Navy `#080C25`
- **Primary**: Neon Green `#3FFF8B` 
- **Typography**: Manrope (headlines) + Be Vietnam Pro (body)
- **Style**: Glassmorphism, tonal layering, no borders

## 📁 Cấu trúc

```
betwise/
├── index.html    # Page structure (3 tabs + settings)
├── style.css     # BetWise Onyx design system
├── engine.js     # 6 core algorithms
└── app.js        # State management & UI logic
```

## 🏃 Chạy local

Mở `index.html` trực tiếp hoặc:

```bash
python -m http.server 3456
```

Truy cập: `http://localhost:3456`

## 📱 Responsive

Optimized cho mobile-first (480px) và scales lên desktop.

## 💾 Data

- Lưu trữ: **LocalStorage** — không mất khi tắt browser
- Export: JSON backup
- Reset: Xóa toàn bộ dữ liệu

## 📄 License

MIT

---

Built with ❤️ by [Miracle9909](https://github.com/Miracle9909)
