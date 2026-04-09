/**
 * BetWise Chatbot — Rule-based Advisor
 * Context-aware betting advice. Refuses off-topic questions.
 */
(function () {
    'use strict';

    let isOpen = false;
    let hasGreeted = false;

    // ===== TOGGLE CHAT =====
    window.toggleChat = function () {
        const panel = document.getElementById('chatPanel');
        const fab = document.getElementById('chatFab');
        isOpen = !isOpen;

        if (isOpen) {
            panel.classList.remove('hidden');
            fab.classList.add('open');
            fab.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
            if (!hasGreeted) {
                hasGreeted = true;
                addBotMessage(getGreeting());
            }
            document.getElementById('chatInput').focus();
        } else {
            panel.classList.add('hidden');
            fab.classList.remove('open');
            fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
        }
    };

    // ===== SEND CHAT =====
    window.sendChat = function () {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        addUserMessage(text);
        input.value = '';
        showTyping();

        setTimeout(() => {
            removeTyping();
            const response = processQuery(text);
            addBotMessage(response);
        }, 600 + Math.random() * 800);
    };

    // ===== QUICK ACTIONS =====
    window.askBot = function (topic) {
        const queries = {
            status: 'Tình trạng hiện tại của tôi thế nào?',
            next: 'Tôi nên làm gì tiếp theo?',
            risk: 'Mức độ rủi ro hiện tại là gì?',
            strategy: 'Chiến thuật phù hợp cho tôi lúc này?',
        };
        const text = queries[topic] || topic;
        addUserMessage(text);
        showTyping();

        setTimeout(() => {
            removeTyping();
            const response = processQuery(text);
            addBotMessage(response);
        }, 600 + Math.random() * 600);
    };

    // ===== GET APP STATE =====
    function getAppState() {
        if (window.BetWiseApp) return window.BetWiseApp.getState();

        // Fallback: read directly from localStorage
        try {
            const raw = localStorage.getItem('betwise_data');
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }

        // Default fresh state
        return {
            initialBankroll: 10_000_000,
            bankroll: 10_000_000,
            target: 500_000_000,
            estimatedWR: 70,
            maxDailyLossPct: 20,
            history: [],
            dailyPL: 0,
            sessionLosses: 0,
        };
    }

    function fmt(n) {
        return window.BetWiseApp ? window.BetWiseApp.fmt(n) : '₫' + n.toLocaleString();
    }

    function fmtFull(n) {
        return window.BetWiseApp ? window.BetWiseApp.fmtFull(n) : '₫' + Math.abs(n).toLocaleString();
    }

    // ===== GREETING =====
    function getGreeting() {
        const s = getAppState();
        if (!s) return 'Xin chào! Tôi là <span class="msg-highlight">BetWise Advisor</span>. Hỏi tôi bất kỳ điều gì về chiến thuật cá cược!';

        if (s.history.length === 0) {
            return `Chào bạn! 👋 Tôi là <span class="msg-highlight">BetWise Advisor</span>.<br><br>Vốn khởi đầu: <span class="msg-highlight">${fmtFull(s.bankroll)}</span><br>Mục tiêu: <span class="msg-highlight">${fmtFull(s.target)}</span><br><br>Bạn chưa có lệnh nào. Hãy bắt đầu bằng cách vào tab <strong>"Lệnh mới"</strong> và đặt lệnh thử nghiệm đầu tiên nhé!<br><br>💡 <em>Gợi ý: Ở giai đoạn đầu, hãy cược 3-5% vốn để xác nhận edge trước khi tăng tốc.</em>`;
        }

        const stats = BetEngine.calcStats(s.history, s.initialBankroll, s.bankroll);
        const stage = BetEngine.getStage(s.bankroll);
        return `Chào bạn! 👋 Đây là tình hình hiện tại:<br><br>📊 Vốn: <span class="msg-highlight">${fmtFull(s.bankroll)}</span> (${stats.profitPct >= 0 ? '+' : ''}${stats.profitPct.toFixed(1)}%)<br>🎯 ${stage.name} — ${stage.label}<br>📈 WR: ${stats.wr.toFixed(1)}% | ${stats.total} lệnh<br><br>Hỏi tôi bất kỳ điều gì về chiến thuật nhé!`;
    }

    // ===== PROCESS QUERY =====
    function processQuery(text) {
        const q = text.toLowerCase();

        // Off-topic filter
        if (isOffTopic(q)) {
            return '🚫 Xin lỗi, tôi chỉ có thể tư vấn về <span class="msg-highlight">chiến thuật cá cược</span>, quản lý vốn, và phân tích rủi ro. Vui lòng hỏi về các chủ đề liên quan nhé!';
        }

        const s = getAppState();
        if (!s) return 'Không thể đọc dữ liệu. Vui lòng tải lại trang.';

        const stats = BetEngine.calcStats(s.history, s.initialBankroll, s.bankroll);
        const streak = BetEngine.analyzeStreak(s.history);
        const stage = BetEngine.getStage(s.bankroll);
        const risk = BetEngine.assessRisk({
            bankroll: s.bankroll,
            initialBankroll: s.initialBankroll,
            history: s.history,
            dailyPL: s.dailyPL,
            sessionLosses: s.sessionLosses,
            maxDailyLossPct: s.maxDailyLossPct,
        });
        const ev = BetEngine.expectedValue(
            s.history.length >= 10 ? BetEngine.calcWinRate(s.history, 50) : s.estimatedWR / 100,
            0.90
        );

        // STATUS / TÌNH TRẠNG
        if (matches(q, ['tình trạng', 'hiện tại', 'status', 'overview', 'tổng quan', 'đang ở đâu', 'vốn bao nhiêu'])) {
            return generateStatusReport(s, stats, stage, streak, risk, ev);
        }

        // NEXT STEP / BƯỚC TIẾP THEO
        if (matches(q, ['tiếp theo', 'nên làm gì', 'next', 'bước', 'khuyến nghị', 'suggest', 'gợi ý'])) {
            return generateNextStep(s, stats, stage, streak, risk, ev);
        }

        // RISK / RỦI RO
        if (matches(q, ['rủi ro', 'risk', 'nguy hiểm', 'an toàn', 'stop loss', 'dừng'])) {
            return generateRiskAdvice(s, stats, stage, streak, risk);
        }

        // STRATEGY / CHIẾN THUẬT
        if (matches(q, ['chiến thuật', 'strategy', 'cách chơi', 'phương pháp', 'kelly', 'sizing'])) {
            return generateStrategyAdvice(s, stats, stage, streak, risk, ev);
        }

        // WIN RATE
        if (matches(q, ['tỉ lệ thắng', 'win rate', 'wr', 'thắng được bao nhiêu'])) {
            return generateWRAnalysis(s, stats, streak);
        }

        // BANKROLL / VỐN
        if (matches(q, ['vốn', 'bankroll', 'tiền', 'lãi', 'lỗ', 'profit', 'pl'])) {
            return generateBankrollAdvice(s, stats, stage);
        }

        // STREAK / CHUỖI
        if (matches(q, ['chuỗi', 'streak', 'liên tiếp', 'thua liên', 'thắng liên'])) {
            return generateStreakAdvice(s, streak, stage);
        }

        // STOP / KHI NÀO DỪNG
        if (matches(q, ['khi nào dừng', 'nên dừng', 'nên nghỉ', 'stop', 'break'])) {
            return generateStopAdvice(s, stats, risk, streak);
        }

        // TARGET / MỤC TIÊU
        if (matches(q, ['mục tiêu', 'target', '500 triệu', 'bao giờ đạt', 'progress'])) {
            return generateTargetAdvice(s, stats, stage);
        }

        // GENERAL BETTING QUESTION
        if (matches(q, ['cược', 'bet', 'đặt', 'lệnh', 'vào', 'bao nhiêu', 'nên cược'])) {
            return generateNextStep(s, stats, stage, streak, risk, ev);
        }

        // Fallback for betting context
        return `Tôi hiểu bạn đang hỏi về: "<em>${text}</em>"<br><br>Hãy thử hỏi cụ thể hơn, ví dụ:<br>• "Tình trạng hiện tại?"<br>• "Nên cược bao nhiêu?"<br>• "Mức rủi ro hiện tại?"<br>• "Chiến thuật phù hợp?"<br>• "Khi nào nên dừng?"<br><br>Hoặc bấm các nút gợi ý bên dưới 👇`;
    }

    // ===== GENERATORS =====
    function generateStatusReport(s, stats, stage, streak, risk, ev) {
        let msg = `📊 <strong>BÁO CÁO TÌNH TRẠNG</strong><br><br>`;
        msg += `💰 Vốn: <span class="msg-highlight">${fmtFull(s.bankroll)}</span>`;
        msg += ` (${stats.profitPct >= 0 ? '+' : ''}${stats.profitPct.toFixed(1)}%)<br>`;
        msg += `🎯 ${stage.name}: ${stage.label}<br>`;
        msg += `📈 WR: <span class="msg-highlight">${stats.wr.toFixed(1)}%</span> | ${stats.wins}W - ${stats.losses}L<br>`;
        msg += `📊 ROI: ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%<br>`;
        msg += `📉 P&L: ${stats.totalPL >= 0 ? '<span class="msg-highlight">+' : '<span class="msg-warn">'}${fmt(stats.totalPL)}</span><br>`;
        msg += `⚡ EV: ${(ev * 100).toFixed(1)}%<br>`;

        if (streak.current > 0 && streak.currentType) {
            msg += `🔥 Chuỗi: ${streak.current} ${streak.currentType === 'WIN' ? 'thắng' : 'thua'} liên tiếp<br>`;
        }

        msg += `<br>⚠️ Rủi ro: `;
        if (risk.level === 'LOW') msg += '<span class="msg-highlight">Thấp ✅</span>';
        else if (risk.level === 'MEDIUM') msg += '<span style="color:#ffb74d;font-weight:600">Trung bình ⚠️</span>';
        else msg += `<span class="msg-warn">${risk.level === 'BLOCKED' ? 'DỪNG 🛑' : 'Cao ❌'}</span>`;

        return msg;
    }

    function generateNextStep(s, stats, stage, streak, risk, ev) {
        if (risk.level === 'BLOCKED') {
            return `🛑 <strong>KHUYẾN NGHỊ: DỪNG LẠI</strong><br><br>Lý do: <span class="msg-warn">${risk.reasons.join(', ')}</span><br><br>Bước tiếp theo:<br>1. Nghỉ ngơi ít nhất 30 phút<br>2. Review lại lịch sử gần đây<br>3. Không cố gỡ — đây là sai lầm phổ biến nhất<br><br>💡 <em>Kỷ luật khi thua mới làm nên người chiến thắng.</em>`;
        }

        const rec = BetEngine.recommend({
            bankroll: s.bankroll, initialBankroll: s.initialBankroll, target: s.target,
            history: s.history, odds: 0.90, confidence: 4,
            dailyPL: s.dailyPL, sessionLosses: s.sessionLosses,
            estimatedWR: s.estimatedWR, maxDailyLossPct: s.maxDailyLossPct,
        });

        let msg = `🎯 <strong>BƯỚC TIẾP THEO</strong><br><br>`;

        if (s.history.length < 10) {
            msg += `📌 Bạn đang ở <span class="msg-highlight">giai đoạn xác nhận Edge</span> (${s.history.length}/10 lệnh).<br><br>`;
            msg += `✅ Nên:<br>• Cược nhỏ (3-5% vốn) = <span class="msg-highlight">${fmtFull(rec.amount)}</span><br>`;
            msg += `• Ghi chép cẩn thận kết quả<br>• Chưa tăng cược cho đến khi WR ≥ 65%<br><br>`;
            msg += `❌ Không nên:<br>• Cược quá 5% vốn<br>• Skip khi gặp chuỗi thua nhỏ<br>• Thay đổi chiến thuật giữa chừng`;
        } else {
            msg += `Hệ thống gợi ý lệnh tiếp theo:<br><br>`;
            msg += `💰 Số tiền: <span class="msg-highlight">${fmtFull(rec.amount)}</span><br>`;
            msg += `📊 Kelly: ${(rec.kellyPct * 100).toFixed(1)}% | ${stage.name}<br>`;

            if (streak.consecutiveLosses >= 2) {
                msg += `<br>⚠️ Đang có ${streak.consecutiveLosses} thua liên tiếp → Đã giảm cược ${streak.consecutiveLosses >= 3 ? '50%' : '30%'}<br>`;
                msg += `💡 <em>Hãy bình tĩnh và tuân theo hệ thống.</em>`;
            } else if (streak.currentType === 'WIN' && streak.current >= 3) {
                msg += `<br>🔥 Chuỗi ${streak.current} thắng! Nhưng hãy nhớ:<br>`;
                msg += `💡 <em>Không tăng cược quá max cho phép. Hot hand là bẫy.</em>`;
            } else {
                msg += `<br>✅ Tình hình ổn định. Tiếp tục theo hệ thống.`;
            }
        }

        return msg;
    }

    function generateRiskAdvice(s, stats, stage, streak, risk) {
        let msg = `⚠️ <strong>ĐÁNH GIÁ RỦI RO</strong><br><br>`;

        msg += `Mức rủi ro: `;
        if (risk.level === 'LOW') msg += '<span class="msg-highlight">THẤP ✅</span>';
        else if (risk.level === 'MEDIUM') msg += '<span style="color:#ffb74d;font-weight:600">TRUNG BÌNH ⚠️</span>';
        else if (risk.level === 'HIGH') msg += '<span class="msg-warn">CAO ❌</span>';
        else msg += '<span class="msg-warn">DỪNG NGAY 🛑</span>';

        msg += `<br>Điểm rủi ro: ${risk.score}/100<br><br>`;

        if (risk.reasons.length > 0 && risk.level !== 'LOW') {
            msg += `📋 Nguyên nhân:<br>`;
            risk.reasons.forEach(r => { msg += `• <span class="msg-warn">${r}</span><br>`; });
            msg += '<br>';
        }

        msg += `📐 Ngưỡng bảo vệ:<br>`;
        msg += `• Stop-loss ngày: ${s.maxDailyLossPct}% (${s.dailyPL < 0 ? 'Đã lỗ ' + (Math.abs(s.dailyPL) / s.bankroll * 100).toFixed(1) + '%' : 'Chưa kích hoạt'})<br>`;
        msg += `• Max cược/lệnh: ${(stage.maxPct * 100)}% = ${fmtFull(Math.round(s.bankroll * stage.maxPct))}<br>`;
        msg += `• Dừng nếu thua 3 liên tiếp<br>`;

        if (risk.level === 'LOW') {
            msg += `<br>✅ An toàn để tiếp tục cược theo hệ thống.`;
        } else {
            msg += `<br>💡 <em>Giảm cược hoặc nghỉ ngơi khi rủi ro cao.</em>`;
        }

        return msg;
    }

    function generateStrategyAdvice(s, stats, stage, streak, risk, ev) {
        let msg = `🧠 <strong>CHIẾN THUẬT HIỆN TẠI</strong><br><br>`;

        msg += `📍 ${stage.name} — ${stage.label}<br>`;
        msg += `📊 Kelly ÷${stage.kellyDiv} (fractional) | Max ${(stage.maxPct * 100)}%<br><br>`;

        msg += `🔬 <strong>Công thức Kelly Criterion:</strong><br>`;
        msg += `f* = (b×p - q) / b<br>`;

        const actualWR = s.history.length >= 10 ? BetEngine.calcWinRate(s.history, 50) : s.estimatedWR / 100;
        const kelly = BetEngine.kellyFraction(actualWR, 0.90);
        msg += `• p = ${(actualWR * 100).toFixed(1)}% | b = 0.90<br>`;
        msg += `• Full Kelly = ${(kelly * 100).toFixed(1)}%<br>`;
        msg += `• Fractional = ${(kelly / stage.kellyDiv * 100).toFixed(1)}% (÷${stage.kellyDiv})<br><br>`;

        if (ev > 0) {
            msg += `✅ EV dương (<span class="msg-highlight">+${(ev * 100).toFixed(1)}%</span>) → Có edge, tiếp tục<br>`;
        } else {
            msg += `<span class="msg-warn">❌ EV âm (${(ev * 100).toFixed(1)}%) → Không có edge ở odds hiện tại</span><br>`;
            msg += `💡 Cần WR > 52.6% với odds 0.90 để có EV dương<br>`;
        }

        msg += `<br>📋 <strong>Quy tắc vàng:</strong><br>`;
        msg += `1. Luôn dùng fractional Kelly, không full<br>`;
        msg += `2. Giảm 30% khi thua 2 liên tiếp<br>`;
        msg += `3. Giảm 50% khi thua 3 liên tiếp<br>`;
        msg += `4. Không bao giờ cược hơn 10% vốn`;

        return msg;
    }

    function generateWRAnalysis(s, stats, streak) {
        if (s.history.length === 0) {
            return `📈 Bạn chưa có lệnh nào. Hãy đặt vài lệnh trước để tôi phân tích WR nhé!<br><br>💡 <em>Cần ít nhất 10 lệnh để có dữ liệu đáng tin cậy.</em>`;
        }

        let msg = `📈 <strong>PHÂN TÍCH TỈ LỆ THẮNG</strong><br><br>`;
        msg += `Tổng quát: <span class="msg-highlight">${stats.wr.toFixed(1)}%</span> (${stats.wins}W/${stats.total})<br>`;

        if (s.history.length >= 10) {
            const recent10 = BetEngine.calcWinRate(s.history, 10) * 100;
            msg += `10 lệnh gần nhất: ${recent10.toFixed(1)}%<br>`;

            if (recent10 < stats.wr - 10) {
                msg += `<span class="msg-warn">⚠️ WR gần đây giảm đáng kể!</span><br>`;
            } else if (recent10 > stats.wr + 5) {
                msg += `<span class="msg-highlight">✅ WR gần đây tăng tốt!</span><br>`;
            }
        }

        msg += `<br>📊 Chuỗi dài nhất: ${streak.longestWin} thắng / ${streak.longestLoss} thua<br>`;
        msg += `🎯 Cần WR ≥ 53% (odds 0.90) để có lợi nhuận dài hạn`;

        if (stats.wr >= 65) {
            msg += `<br><br><span class="msg-highlight">🎉 WR rất tốt! Bạn đang có edge rõ ràng.</span>`;
        } else if (stats.wr >= 53) {
            msg += `<br><br>✅ WR đủ để có lợi nhuận. Tiếp tục giữ kỷ luật!`;
        } else if (stats.total >= 20) {
            msg += `<br><br><span class="msg-warn">⚠️ WR dưới ngưỡng lợi nhuận. Cân nhắc dừng và review chiến thuật.</span>`;
        }

        return msg;
    }

    function generateBankrollAdvice(s, stats, stage) {
        let msg = `💰 <strong>TÌNH HÌNH VỐN</strong><br><br>`;
        msg += `Vốn ban đầu: ${fmtFull(s.initialBankroll)}<br>`;
        msg += `Vốn hiện tại: <span class="msg-highlight">${fmtFull(s.bankroll)}</span><br>`;
        msg += `P&L: ${stats.totalPL >= 0 ? '<span class="msg-highlight">+' : '<span class="msg-warn">'}${fmtFull(stats.totalPL)}</span> (${stats.profitPct >= 0 ? '+' : ''}${stats.profitPct.toFixed(1)}%)<br>`;
        msg += `ROI: ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%<br><br>`;

        const progress = (s.bankroll / s.target * 100).toFixed(1);
        msg += `🏁 Tiến độ: ${progress}% → ${fmtFull(s.target)}<br>`;
        msg += `📍 ${stage.name}: ${stage.label}`;

        if (s.bankroll < s.initialBankroll * 0.7) {
            msg += `<br><br><span class="msg-warn">⚠️ Vốn giảm đáng kể. Hãy giảm cược và review chiến thuật trước khi tiếp tục.</span>`;
        }

        return msg;
    }

    function generateStreakAdvice(s, streak, stage) {
        if (s.history.length === 0) {
            return '📊 Chưa có dữ liệu chuỗi. Hãy vào vài lệnh trước nhé!';
        }

        let msg = `🔥 <strong>PHÂN TÍCH CHUỖI</strong><br><br>`;
        msg += `Hiện tại: <span class="msg-highlight">${streak.current} ${streak.currentType === 'WIN' ? 'thắng' : 'thua'}</span> liên tiếp<br>`;
        msg += `Kỷ lục thắng: ${streak.longestWin} | Kỷ lục thua: ${streak.longestLoss}<br><br>`;

        if (streak.consecutiveLosses >= 3) {
            msg += `<span class="msg-warn">🛑 ${streak.consecutiveLosses} thua liên tiếp!</span><br>`;
            msg += `→ Hệ thống đã tự động giảm 50% cược<br>`;
            msg += `💡 <em>Khuyến nghị: Nghỉ ngơi 30 phút trước khi tiếp tục</em>`;
        } else if (streak.consecutiveLosses >= 2) {
            msg += `⚠️ 2 thua liên tiếp<br>`;
            msg += `→ Hệ thống đã giảm 30% cược<br>`;
            msg += `💡 <em>Bình tĩnh, tuân theo hệ thống Kelly</em>`;
        } else if (streak.currentType === 'WIN' && streak.current >= 4) {
            msg += `🔥 Chuỗi thắng đẹp! Nhưng hãy nhớ:<br>`;
            msg += `• Không tăng cược vì "đang hên"<br>`;
            msg += `• Hot hand fallacy là kẻ thù #1<br>`;
            msg += `• Giữ đúng % Kelly dù đang thắng`;
        } else {
            msg += `✅ Chuỗi ổn định. Tiếp tục theo kế hoạch.`;
        }

        return msg;
    }

    function generateStopAdvice(s, stats, risk, streak) {
        let msg = `⏸️ <strong>KHI NÀO NÊN DỪNG?</strong><br><br>`;

        let shouldStop = false;
        msg += `Checklist dừng lệnh:<br>`;

        // Check 1: Consecutive losses
        const cl = streak.consecutiveLosses >= 3;
        msg += `${cl ? '🔴' : '🟢'} Thua ≥3 liên tiếp: ${cl ? 'CÓ → DỪNG' : 'Không'}<br>`;
        if (cl) shouldStop = true;

        // Check 2: Daily stop loss
        const dlLoss = s.dailyPL < 0 && (Math.abs(s.dailyPL) / s.bankroll * 100) >= s.maxDailyLossPct;
        msg += `${dlLoss ? '🔴' : '🟢'} Lỗ ngày ≥${s.maxDailyLossPct}%: ${dlLoss ? 'CÓ → DỪNG' : 'Không'}<br>`;
        if (dlLoss) shouldStop = true;

        // Check 3: Bankroll < 50%
        const halfLost = s.bankroll < s.initialBankroll * 0.5;
        msg += `${halfLost ? '🔴' : '🟢'} Vốn giảm ≥50%: ${halfLost ? 'CÓ → DỪNG' : 'Không'}<br>`;
        if (halfLost) shouldStop = true;

        // Check 4: Risk score
        const highRisk = risk.level === 'HIGH' || risk.level === 'BLOCKED';
        msg += `${highRisk ? '🔴' : '🟢'} Rủi ro cao: ${highRisk ? 'CÓ → Giảm/ DỪNG' : 'Không'}<br>`;
        if (highRisk) shouldStop = true;

        msg += `<br>`;
        if (shouldStop) {
            msg += `<span class="msg-warn">⚠️ Có tín hiệu dừng! Hãy nghỉ ngơi và review trước khi tiếp tục.</span>`;
        } else {
            msg += `<span class="msg-highlight">✅ Chưa có tín hiệu dừng. An toàn để tiếp tục.</span>`;
        }

        return msg;
    }

    function generateTargetAdvice(s, stats, stage) {
        const progress = (s.bankroll / s.target * 100);
        let msg = `🏁 <strong>TIẾN ĐỘ MỤC TIÊU</strong><br><br>`;
        msg += `Hiện tại: <span class="msg-highlight">${fmtFull(s.bankroll)}</span> / ${fmtFull(s.target)}<br>`;
        msg += `Tiến độ: <span class="msg-highlight">${progress.toFixed(1)}%</span><br>`;
        msg += `Còn cần: ${fmtFull(s.target - s.bankroll)}<br><br>`;

        if (stats.total >= 10 && stats.wr > 50) {
            const avgProfit = stats.totalPL / stats.total;
            if (avgProfit > 0) {
                const betsNeeded = Math.ceil((s.target - s.bankroll) / avgProfit);
                const hoursNeeded = Math.ceil(betsNeeded * 40 / 60);
                msg += `📐 Ước tính (dựa trên hiệu suất hiện tại):<br>`;
                msg += `• Lãi TB/lệnh: ${fmt(Math.round(avgProfit))}<br>`;
                msg += `• Cần ~${betsNeeded} lệnh nữa<br>`;
                msg += `• ~${hoursNeeded} giờ chơi (40 phút/trận)<br><br>`;
                msg += `💡 <em>Đây là ước tính. Thực tế có thể dao động rất lớn do phương sai.</em>`;
            } else {
                msg += `<span class="msg-warn">⚠️ Hiệu suất hiện tại âm. Cần cải thiện WR trước khi tính mục tiêu.</span>`;
            }
        } else {
            msg += `💡 Cần ít nhất 10 lệnh để ước tính thời gian đạt mục tiêu.`;
        }

        return msg;
    }

    // ===== OFF-TOPIC DETECTION =====
    function isOffTopic(q) {
        const offTopicPatterns = [
            'thời tiết', 'weather', 'nấu ăn', 'cooking', 'chính trị', 'politics',
            'code', 'lập trình', 'programming', 'phim', 'movie', 'nhạc', 'music',
            'hack', 'cheat', 'bẻ khóa', 'tình yêu', 'love', 'triết học', 'philosophy',
            'toán học', 'math', 'lịch sử', 'history', 'game khác', 'minecraft',
            'fortnite', 'valorant', 'facebook', 'tiktok', 'instagram', 'youtube',
            'bitcoin', 'crypto', 'forex', 'stock', 'chứng khoán',
            'ai là', 'who is', 'who are you', 'bạn là ai', 'tên gì',
        ];

        // Allow betting-related keywords
        const onTopicPatterns = [
            'cược', 'bet', 'vốn', 'bankroll', 'thắng', 'thua', 'win', 'loss',
            'kelly', 'odds', 'rủi ro', 'risk', 'chiến thuật', 'strategy',
            'lệnh', 'chuỗi', 'streak', 'roi', 'ev', 'expected', 'dừng', 'stop',
            'mục tiêu', 'target', 'lãi', 'lỗ', 'profit', 'tình trạng', 'status',
            'tiếp theo', 'next', 'gợi ý', 'suggest', 'tư vấn', 'khuyến nghị',
            'esport', 'dota', 'lol', 'rồng', 'dragon', 'kèo', 'rate',
            'phân tích', 'quản lý', 'bảo toàn', 'tối ưu', 'hiệu suất',
        ];

        const hasOnTopic = onTopicPatterns.some(p => q.includes(p));
        if (hasOnTopic) return false;

        return offTopicPatterns.some(p => q.includes(p));
    }

    // ===== UTILS =====
    function matches(q, keywords) {
        return keywords.some(k => q.includes(k));
    }

    function addBotMessage(html) {
        const container = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = 'chat-msg bot';
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function addUserMessage(text) {
        const container = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = 'chat-msg user';
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function showTyping() {
        const container = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = 'chat-typing';
        div.id = 'typingIndicator';
        div.innerHTML = '<span></span><span></span><span></span>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function removeTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

})();
