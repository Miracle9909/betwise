/**
 * BetWise Chatbot v2.0 — Advanced Advisor + Motivational Coach
 * Leverages Engine v2 (Bayesian WR, Momentum, Edge, Tilt, Session Analysis)
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
        setTimeout(() => { removeTyping(); addBotMessage(processQuery(text)); }, 500 + Math.random() * 700);
    };

    // ===== QUICK ACTIONS =====
    window.askBot = function (topic) {
        const queries = {
            status: 'Tình trạng hiện tại của tôi thế nào?',
            next: 'Tôi nên làm gì tiếp theo?',
            risk: 'Mức độ rủi ro hiện tại là gì?',
            strategy: 'Chiến thuật phù hợp cho tôi lúc này?',
        };
        addUserMessage(queries[topic] || topic);
        showTyping();
        setTimeout(() => { removeTyping(); addBotMessage(processQuery(queries[topic] || topic)); }, 500 + Math.random() * 500);
    };

    // ===== GET STATE =====
    function getState() {
        if (window.BetWiseApp) return window.BetWiseApp.getState();
        try { const r = localStorage.getItem('betwise_data'); if (r) return JSON.parse(r); } catch (e) { }
        return { initialBankroll: 10_000_000, bankroll: 10_000_000, target: 500_000_000, estimatedWR: 70, maxDailyLossPct: 20, history: [], dailyPL: 0, sessionLosses: 0 };
    }

    function fmt(n) { return window.BetWiseApp ? window.BetWiseApp.fmt(n) : '₫' + n.toLocaleString(); }
    function fmtFull(n) { return window.BetWiseApp ? window.BetWiseApp.fmtFull(n) : '₫' + Math.abs(n).toLocaleString(); }

    // ===== GREETING =====
    function getGreeting() {
        const s = getState();
        if (s.history.length === 0) {
            return `Chào bạn! 👋 Tôi là <span class="msg-highlight">BetWise Advisor v2</span> — trợ lý phân tích xác suất cá nhân.<br><br>` +
                `💰 Vốn: <span class="msg-highlight">${fmtFull(s.bankroll)}</span><br>` +
                `🎯 Mục tiêu: ${fmtFull(s.target)}<br><br>` +
                `🚀 Bạn chưa có lệnh nào. Bắt đầu với 3-5% vốn để hệ thống calibrate Bayesian WR.<br><br>` +
                `💡 <em>Hỏi tôi bất cứ lúc nào — tôi phân tích realtime dựa trên dữ liệu của bạn.</em>`;
        }

        const stats = BetEngine.calcStats(s.history, s.initialBankroll, s.bankroll);
        const stage = BetEngine.getStage(s.bankroll);
        const edge = BetEngine.edgeStrength(s.history, 0.90, s.estimatedWR);
        const motivation = BetEngine.getMotivation(s.history, s.bankroll, s.initialBankroll);

        return `Chào lại! 👋<br><br>` +
            `💰 Vốn: <span class="msg-highlight">${fmtFull(s.bankroll)}</span> (${stats.profitPct >= 0 ? '+' : ''}${stats.profitPct.toFixed(1)}%)<br>` +
            `🎯 ${stage.name} — ${stage.label}<br>` +
            `📈 WR: <span class="msg-highlight">${stats.wr.toFixed(1)}%</span> | Edge: ${edge.label}<br>` +
            `📊 Momentum: ${edge.momentum > 20 ? '📈 Tốt' : edge.momentum < -20 ? '📉 Yếu' : '➡️ Trung tính'}<br><br>` +
            `${motivation}`;
    }

    // ===== PROCESS QUERY =====
    function processQuery(text) {
        const q = text.toLowerCase();
        if (isOffTopic(q)) {
            return '🚫 Tôi chỉ tư vấn về <span class="msg-highlight">chiến thuật cá cược, xác suất, và quản lý vốn</span>. Hỏi tôi về: tình trạng, rủi ro, chiến thuật, chuỗi, hoặc mục tiêu nhé!';
        }

        const s = getState();
        const stats = BetEngine.calcStats(s.history, s.initialBankroll, s.bankroll);
        const streak = BetEngine.analyzeStreak(s.history);
        const stage = BetEngine.getStage(s.bankroll);
        const risk = BetEngine.assessRisk({ bankroll: s.bankroll, initialBankroll: s.initialBankroll, history: s.history, dailyPL: s.dailyPL, sessionLosses: s.sessionLosses, maxDailyLossPct: s.maxDailyLossPct });
        const edge = BetEngine.edgeStrength(s.history, 0.90, s.estimatedWR);
        const tilt = BetEngine.detectTilt(s.history);
        const session = BetEngine.sessionAnalysis(s.history, s.initialBankroll, s.bankroll);
        const time = BetEngine.analyzeTimePatterns(s.history);
        const motivation = BetEngine.getMotivation(s.history, s.bankroll, s.initialBankroll);

        // Priority matches (specific topics first, general last)
        if (matches(q, ['động lực', 'motivat', 'tinh thần', 'cổ vũ', 'cheer'])) return genMotivation(s, stats, motivation);
        if (matches(q, ['tilt', 'cảm xúc', 'tâm lý', 'bình tĩnh', 'tâm trạng'])) return genTilt(s, tilt, streak);
        if (matches(q, ['momentum', 'đà', 'trend', 'xu hướng'])) return genMomentum(s, edge, streak);
        if (matches(q, ['tình trạng', 'hiện tại', 'status', 'overview', 'tổng quan'])) return genStatus(s, stats, stage, streak, risk, edge, session, motivation);
        if (matches(q, ['rủi ro', 'risk', 'nguy hiểm', 'an toàn', 'stop loss'])) return genRisk(s, stats, stage, streak, risk, tilt, edge);
        if (matches(q, ['chiến thuật', 'strategy', 'cách chơi', 'kelly', 'sizing', 'phương pháp'])) return genStrategy(s, stats, stage, edge, session);
        if (matches(q, ['tỉ lệ thắng', 'win rate', 'wr', 'bayesian', 'xác suất'])) return genWR(s, stats, streak, edge);
        if (matches(q, ['vốn', 'bankroll', 'tiền', 'lãi', 'lỗ', 'profit'])) return genBankroll(s, stats, stage, session);
        if (matches(q, ['chuỗi', 'streak', 'liên tiếp', 'thua liên', 'thắng liên'])) return genStreak(s, streak, stage, motivation);
        if (matches(q, ['dừng', 'nghỉ', 'stop', 'break', 'khi nào'])) return genStop(s, stats, risk, streak, tilt);
        if (matches(q, ['mục tiêu', 'target', 'progress', 'bao giờ'])) return genTarget(s, stats, stage);
        if (matches(q, ['thời gian', 'khung giờ', 'time', 'giờ nào'])) return genTime(s, time);
        if (matches(q, ['tiếp theo', 'nên làm gì', 'next', 'bước', 'gợi ý', 'suggest', 'khuyến nghị'])) return genNextStep(s, stats, stage, streak, risk, edge, tilt, motivation);
        if (matches(q, ['cược', 'bet', 'đặt', 'lệnh', 'vào', 'bao nhiêu', 'nên cược'])) return genNextStep(s, stats, stage, streak, risk, edge, tilt, motivation);

        return `Tôi hiểu bạn đang hỏi: "<em>${text}</em>"<br><br>Hãy thử hỏi cụ thể:<br>• "Tình trạng hiện tại?"<br>• "Nên cược bao nhiêu?"<br>• "Phân tích momentum?"<br>• "Tâm lý tôi đang thế nào?"<br>• "Khung giờ nào tốt nhất?"<br>• "Cho tôi động lực!"<br><br>Hoặc bấm nút gợi ý bên dưới 👇`;
    }

    // ===== RESPONSE GENERATORS =====

    function genStatus(s, stats, stage, streak, risk, edge, session, motivation) {
        let m = `📊 <strong>BÁO CÁO PHÂN TÍCH</strong><br><br>`;
        m += `💰 Vốn: <span class="msg-highlight">${fmtFull(s.bankroll)}</span> (${stats.profitPct >= 0 ? '+' : ''}${stats.profitPct.toFixed(1)}%)<br>`;
        m += `🎯 ${stage.name}: ${stage.label}<br>`;
        m += `📈 WR: <span class="msg-highlight">${stats.wr.toFixed(1)}%</span> | Bayesian: ${(BetEngine.bayesianWinRate(s.history) * 100).toFixed(1)}%<br>`;
        m += `📊 ROI: ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}% | P&L: ${stats.totalPL >= 0 ? '<span class="msg-highlight">+' : '<span class="msg-warn">'}${fmt(stats.totalPL)}</span><br>`;
        m += `⚡ Edge: <span class="msg-highlight">${edge.label}</span> (${edge.score}/100) | EV: ${(edge.ev * 100).toFixed(1)}%<br>`;
        m += `📉 Momentum: ${edge.momentum > 20 ? '<span class="msg-highlight">📈 Tích cực</span>' : edge.momentum < -20 ? '<span class="msg-warn">📉 Tiêu cực</span>' : '➡️ Trung tính'} (${edge.momentum > 0 ? '+' : ''}${edge.momentum})<br>`;
        if (streak.current > 0) m += `🔥 Chuỗi: ${streak.current} ${streak.currentType === 'WIN' ? 'thắng' : 'thua'} liên tiếp<br>`;
        m += `🏗️ Session: ${session.phase} | PF: ${session.profitFactor === Infinity ? '∞' : session.profitFactor.toFixed(2)}<br>`;
        m += `<br>⚠️ Rủi ro: ${riskBadge(risk.level)} (${risk.score}/100)<br>`;
        m += `<br>${motivation}`;
        return m;
    }

    function genNextStep(s, stats, stage, streak, risk, edge, tilt, motivation) {
        if (risk.level === 'BLOCKED') {
            return `🛑 <strong>DỪNG LẠI!</strong><br><br>` +
                `Lý do: <span class="msg-warn">${risk.reasons.join(', ')}</span><br><br>` +
                `Bước tiếp:<br>1. ⏸️ Nghỉ ngơi ít nhất 30 phút<br>2. 📖 Review lại lịch sử gần đây<br>3. 🧘 Không cố gỡ — đây là sai lầm phổ biến nhất<br><br>` +
                `💡 <em>Người chiến thắng không phải người thắng mọi lệnh, mà là người biết DỪNG đúng lúc.</em>`;
        }

        if (tilt.isTilting) {
            return `🧠 <strong>CẢNH BÁO TÂM LÝ</strong><br><br>` +
                `Hệ thống phát hiện dấu hiệu TILT:<br>` +
                tilt.signals.map(s => `• <span class="msg-warn">${s}</span>`).join('<br>') + `<br><br>` +
                `Khuyến nghị: <span class="msg-warn">DỪNG hoặc giảm 50% sizing</span><br><br>` +
                `💡 <em>Tilt = kẻ thù #1. Khi cảm xúc lên, xác suất thắng giảm.</em>`;
        }

        const rec = BetEngine.recommend({
            bankroll: s.bankroll, initialBankroll: s.initialBankroll, target: s.target,
            history: s.history, odds: 0.90, confidence: 0,
            dailyPL: s.dailyPL, sessionLosses: s.sessionLosses,
            estimatedWR: s.estimatedWR, maxDailyLossPct: s.maxDailyLossPct,
        });

        let m = `🎯 <strong>KHUYẾN NGHỊ LỆNH TIẾP</strong><br><br>`;

        if (s.history.length < 10) {
            m += `📌 <span class="msg-highlight">Giai đoạn calibrate</span> (${s.history.length}/10 lệnh)<br>`;
            m += `Hệ thống đang thu thập dữ liệu để calibrate Bayesian WR.<br><br>`;
            m += `💰 Cược khuyến nghị: <span class="msg-highlight">${fmtFull(rec.amount)}</span> (3-5% vốn)<br>`;
            m += `📊 Kelly: ${(rec.kellyPct * 100).toFixed(1)}% | Edge: ${edge.label}<br><br>`;
            m += `✅ Nên: Cược nhỏ, ghi chép cẩn thận, tin vào quy trình<br>`;
            m += `❌ Không: Cược lớn, thay đổi chiến thuật, bỏ qua stop-loss`;
        } else {
            m += `💰 Số tiền: <span class="msg-highlight">${fmtFull(rec.amount)}</span><br>`;
            m += `📊 Kelly: ${(rec.kellyPct * 100).toFixed(1)}% | Edge: ${edge.label} (${edge.score}/100)<br>`;
            m += `📈 Momentum: ${edge.momentum > 0 ? '+' : ''}${edge.momentum} | Bayesian WR: ${(BetEngine.bayesianWinRate(s.history) * 100).toFixed(1)}%<br>`;

            if (streak.consecutiveLosses >= 2) {
                m += `<br>⚠️ ${streak.consecutiveLosses} thua liên tiếp → Đã giảm cược ${streak.consecutiveLosses >= 3 ? '50-70%' : '30%'}<br>`;
                m += `💡 <em>Variance là bình thường. Hệ thống tự bảo vệ vốn cho bạn.</em>`;
            } else if (streak.currentType === 'WIN' && streak.current >= 3) {
                m += `<br>🔥 Chuỗi ${streak.current} thắng! Tuyệt vời!<br>`;
                m += `💡 <em>Nhưng GIỮ ĐÚNG sizing. "Hot hand" là bẫy tâm lý.</em>`;
            } else {
                m += `<br>✅ Tình hình ổn định. Tiếp tục theo hệ thống.`;
            }
        }

        m += `<br><br>${motivation}`;
        return m;
    }

    function genRisk(s, stats, stage, streak, risk, tilt, edge) {
        let m = `⚠️ <strong>ĐÁNH GIÁ RỦI RO ĐA CHIỀU</strong><br><br>`;
        m += `Mức rủi ro: ${riskBadge(risk.level)} (${risk.score}/100)<br><br>`;

        m += `📋 <strong>5 yếu tố phân tích:</strong><br>`;
        m += `${streak.consecutiveLosses >= 2 ? '🔴' : '🟢'} Chuỗi thua: ${streak.consecutiveLosses} liên tiếp<br>`;
        const dlPct = s.dailyPL < 0 ? (Math.abs(s.dailyPL) / s.bankroll * 100).toFixed(1) : '0';
        m += `${parseFloat(dlPct) >= s.maxDailyLossPct ? '🔴' : '🟢'} Stop-loss ngày: ${dlPct}% / ${s.maxDailyLossPct}%<br>`;
        m += `${edge.momentum < -30 ? '🔴' : '🟢'} Momentum: ${edge.momentum > 0 ? '+' : ''}${edge.momentum}<br>`;
        m += `${tilt.isTilting ? '🔴' : '🟢'} Tilt: ${tilt.isTilting ? `Phát hiện (${tilt.severity}/100)` : 'Không'}<br>`;
        m += `${s.bankroll < s.initialBankroll * 0.7 ? '🟡' : '🟢'} Vốn: ${((s.bankroll / s.initialBankroll) * 100).toFixed(0)}% ban đầu<br>`;

        if (risk.reasons.length > 0 && risk.level !== 'LOW') {
            m += `<br>⚡ Chi tiết:<br>`;
            risk.reasons.forEach(r => { m += `• <span class="msg-warn">${r}</span><br>`; });
        }

        m += `<br>📐 Ngưỡng bảo vệ: Max ${(stage.maxPct * 100)}% = ${fmtFull(Math.round(s.bankroll * stage.maxPct))}/lệnh<br>`;

        if (risk.level === 'LOW') m += `<br>✅ <span class="msg-highlight">An toàn để cược. Tất cả chỉ số tốt!</span>`;
        else m += `<br>💡 <em>Giảm cược hoặc nghỉ ngơi khi rủi ro tăng.</em>`;

        return m;
    }

    function genStrategy(s, stats, stage, edge, session) {
        const wr = s.history.length >= 5 ? BetEngine.bayesianWinRate(s.history) : s.estimatedWR / 100;
        const kelly = BetEngine.kellyFraction(wr, 0.90);
        const ci = s.history.length >= 5 ? BetEngine.bayesianCI(s.history) : null;

        let m = `🧠 <strong>PHÂN TÍCH CHIẾN THUẬT</strong><br><br>`;
        m += `📍 ${stage.name} — ${stage.label} | Kelly ÷${stage.kellyDiv}<br><br>`;

        m += `🔬 <strong>Kelly Criterion (Bayesian):</strong><br>`;
        m += `• WR Bayesian: ${(wr * 100).toFixed(1)}%`;
        if (ci) m += ` [${(ci.lower * 100).toFixed(1)}% - ${(ci.upper * 100).toFixed(1)}%]`;
        m += `<br>`;
        m += `• Full Kelly: ${(kelly * 100).toFixed(1)}%<br>`;
        m += `• Fractional (÷${stage.kellyDiv}): <span class="msg-highlight">${(kelly / stage.kellyDiv * 100).toFixed(1)}%</span><br><br>`;

        m += `⚡ <strong>Edge Analysis:</strong><br>`;
        m += `• Điểm edge: <span class="msg-highlight">${edge.score}/100 (${edge.label})</span><br>`;
        m += `• EV/lệnh: ${edge.ev >= 0 ? '<span class="msg-highlight">+' : '<span class="msg-warn">'}${(edge.ev * 100).toFixed(1)}%</span><br>`;
        m += `• Momentum: ${edge.momentum > 0 ? '+' : ''}${edge.momentum}<br><br>`;

        m += `🏗️ <strong>Session Health:</strong><br>`;
        m += `• Phase: ${session.phase} | Profit Factor: ${session.profitFactor === Infinity ? '∞' : session.profitFactor.toFixed(2)}<br>`;
        m += `• Sharpe: ${session.sharpeRatio.toFixed(2)} | Max DD: ${(session.maxDrawdown * 100).toFixed(1)}%<br>`;
        m += `• R:R Ratio: ${session.riskRewardRatio.toFixed(2)}<br>`;
        m += `• ${session.recommendation}<br><br>`;

        m += `📋 <strong>Quy tắc vàng:</strong><br>`;
        m += `1. Luôn dùng Fractional Kelly<br>`;
        m += `2. Giảm 30% sau 2 thua, 50% sau 3, 70% sau 4<br>`;
        m += `3. Không bao giờ > ${(stage.maxPct * 100)}% vốn<br>`;
        m += `4. Cần WR > 52.6% (odds 0.90) để có EV+`;

        return m;
    }

    function genWR(s, stats, streak, edge) {
        if (s.history.length === 0) return '📈 Chưa có dữ liệu. Đặt vài lệnh để hệ thống calibrate Bayesian WR nhé!';

        const bayesWR = BetEngine.bayesianWinRate(s.history);
        const ci = BetEngine.bayesianCI(s.history);

        let m = `📈 <strong>PHÂN TÍCH XÁC SUẤT</strong><br><br>`;
        m += `WR thô: <span class="msg-highlight">${stats.wr.toFixed(1)}%</span> (${stats.wins}/${stats.total})<br>`;
        m += `WR Bayesian: <span class="msg-highlight">${(bayesWR * 100).toFixed(1)}%</span><br>`;
        m += `Khoảng tin cậy 95%: [${(ci.lower * 100).toFixed(1)}% — ${(ci.upper * 100).toFixed(1)}%]<br>`;
        m += `Độ chính xác: ±${(ci.sd * 100).toFixed(1)}%<br><br>`;

        if (s.history.length >= 10) {
            const recent10 = BetEngine.calcWinRate(s.history, 10) * 100;
            m += `📊 10 lệnh gần nhất: ${recent10.toFixed(1)}%`;
            m += recent10 > stats.wr + 5 ? ' <span class="msg-highlight">↑ Đang tăng!</span>' : recent10 < stats.wr - 10 ? ' <span class="msg-warn">↓ Đang giảm!</span>' : ' ➡️ Ổn định';
            m += '<br>';
        }

        m += `<br>🔬 <strong>Phân tích Bayesian:</strong><br>`;
        m += `Hệ thống dùng Beta(${7 + stats.wins}, ${3 + stats.losses}) distribution.<br>`;
        m += `Prior: 70% (niềm tin ban đầu).<br>`;
        m += `Posterior: ${(bayesWR * 100).toFixed(1)}% (cập nhật từ ${stats.total} lệnh).<br><br>`;

        if (ci.lower > 0.526) m += `<span class="msg-highlight">✅ Ngay cả worst-case (${(ci.lower * 100).toFixed(1)}%) vẫn có EV+!</span>`;
        else if (bayesWR > 0.526) m += `✅ Bayesian WR > 52.6% → Có edge, nhưng CI còn rộng. Cần thêm data.`;
        else m += `<span class="msg-warn">⚠️ Bayesian WR < ngưỡng EV+. Cân nhắc review chiến thuật.</span>`;

        return m;
    }

    function genBankroll(s, stats, stage, session) {
        let m = `💰 <strong>SỨC KHỎE VỐN</strong><br><br>`;
        m += `Ban đầu: ${fmtFull(s.initialBankroll)}<br>`;
        m += `Hiện tại: <span class="msg-highlight">${fmtFull(s.bankroll)}</span><br>`;
        m += `P&L: ${stats.totalPL >= 0 ? '<span class="msg-highlight">+' : '<span class="msg-warn">'}${fmtFull(stats.totalPL)}</span> (${stats.profitPct >= 0 ? '+' : ''}${stats.profitPct.toFixed(1)}%)<br>`;
        m += `ROI: ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%<br><br>`;

        m += `🏗️ <strong>Session Metrics:</strong><br>`;
        m += `• Profit Factor: ${session.profitFactor === Infinity ? '∞' : session.profitFactor.toFixed(2)} ${session.profitFactor > 1.5 ? '✅' : session.profitFactor < 0.8 ? '❌' : '⚠️'}<br>`;
        m += `• Max Drawdown: ${(session.maxDrawdown * 100).toFixed(1)}%<br>`;
        m += `• Avg Win: ${fmtFull(Math.round(session.avgWinSize))}<br>`;
        m += `• Avg Loss: ${fmtFull(Math.round(session.avgLossSize))}<br>`;
        m += `• ${session.recommendation}<br><br>`;

        const progress = (s.bankroll / s.target * 100).toFixed(1);
        m += `🏁 Tiến độ: ${progress}% → ${fmtFull(s.target)}`;

        if (s.bankroll < s.initialBankroll * 0.7) {
            m += `<br><br><span class="msg-warn">⚠️ Vốn giảm đáng kể. Review chiến thuật trước khi tiếp tục.</span>`;
        }
        return m;
    }

    function genStreak(s, streak, stage, motivation) {
        if (s.history.length === 0) return '📊 Chưa có dữ liệu chuỗi.';
        let m = `🔥 <strong>PHÂN TÍCH CHUỖI</strong><br><br>`;
        m += `Hiện tại: <span class="msg-highlight">${streak.current} ${streak.currentType === 'WIN' ? 'thắng' : 'thua'}</span><br>`;
        m += `Kỷ lục: ${streak.longestWin}W / ${streak.longestLoss}L<br><br>`;

        if (streak.consecutiveLosses >= 3) {
            m += `<span class="msg-warn">🛑 ${streak.consecutiveLosses} thua liên tiếp!</span><br>`;
            m += `→ Hệ thống đã giảm ${streak.consecutiveLosses >= 4 ? '70%' : '50%'} sizing<br>`;
            m += `→ Xác suất thua ${streak.consecutiveLosses} liên tiếp (WR 70%): ~${(Math.pow(0.3, streak.consecutiveLosses) * 100).toFixed(2)}%<br>`;
            m += `💡 <em>Đây là variance, KHÔNG phải lỗi của bạn. Nghỉ 30 phút.</em>`;
        } else if (streak.currentType === 'WIN' && streak.current >= 3) {
            m += `🔥 Chuỗi thắng đẹp!<br>`;
            m += `Xác suất ${streak.current} thắng liên tiếp (WR 70%): ~${(Math.pow(0.7, streak.current) * 100).toFixed(1)}%<br>`;
            m += `💡 <em>Giữ đúng sizing. Hot hand fallacy là kẻ thù!</em>`;
        } else {
            m += `✅ Chuỗi bình thường. Tiếp tục theo kế hoạch.`;
        }

        m += `<br><br>${motivation}`;
        return m;
    }

    function genStop(s, stats, risk, streak, tilt) {
        let m = `⏸️ <strong>CHECKLIST DỪNG LỆNH</strong><br><br>`;
        let shouldStop = false;

        const checks = [
            { label: 'Thua ≥3 liên tiếp', bad: streak.consecutiveLosses >= 3 },
            { label: `Lỗ ngày ≥${s.maxDailyLossPct}%`, bad: s.dailyPL < 0 && (Math.abs(s.dailyPL) / s.bankroll * 100) >= s.maxDailyLossPct },
            { label: 'Vốn giảm ≥50%', bad: s.bankroll < s.initialBankroll * 0.5 },
            { label: 'Rủi ro cao/BLOCKED', bad: risk.level === 'HIGH' || risk.level === 'BLOCKED' },
            { label: 'Phát hiện TILT', bad: tilt.isTilting },
        ];

        checks.forEach(c => {
            m += `${c.bad ? '🔴' : '🟢'} ${c.label}: ${c.bad ? '<span class="msg-warn">CÓ</span>' : 'Không'}<br>`;
            if (c.bad) shouldStop = true;
        });

        m += `<br>`;
        if (shouldStop) m += `<span class="msg-warn">⚠️ Có tín hiệu dừng! Hãy nghỉ ngơi.</span><br><br>`;
        else m += `<span class="msg-highlight">✅ Chưa có tín hiệu dừng. An toàn để tiếp tục.</span><br><br>`;

        m += `💡 <em>Nhớ: Biết dừng đúng lúc > thắng thêm 1 lệnh.</em>`;
        return m;
    }

    function genTarget(s, stats, stage) {
        const progress = (s.bankroll / s.target * 100);
        let m = `🏁 <strong>TIẾN ĐỘ MỤC TIÊU</strong><br><br>`;
        m += `Hiện tại: <span class="msg-highlight">${fmtFull(s.bankroll)}</span> / ${fmtFull(s.target)}<br>`;
        m += `Tiến độ: <span class="msg-highlight">${progress.toFixed(1)}%</span><br>`;
        m += `Còn cần: ${fmtFull(s.target - s.bankroll)}<br><br>`;

        if (stats.total >= 10 && stats.wr > 50) {
            const avgProfit = stats.totalPL / stats.total;
            if (avgProfit > 0) {
                const betsNeeded = Math.ceil((s.target - s.bankroll) / avgProfit);
                m += `📐 Ước tính (dựa trên data):<br>`;
                m += `• Lãi TB/lệnh: ${fmt(Math.round(avgProfit))}<br>`;
                m += `• Cần ~${betsNeeded} lệnh nữa<br>`;
                m += `• ~${Math.ceil(betsNeeded * 40 / 60)} giờ (40 phút/trận)<br><br>`;
                m += `💡 <em>⚠️ Ước tính. Thực tế dao động do variance. Compound interest sẽ tăng tốc.</em>`;
            }
        } else {
            m += `💡 Cần ≥10 lệnh để ước tính.`;
        }
        return m;
    }

    function genMomentum(s, edge, streak) {
        let m = `📈 <strong>PHÂN TÍCH MOMENTUM</strong><br><br>`;
        m += `Điểm momentum: <span class="msg-highlight">${edge.momentum > 0 ? '+' : ''}${edge.momentum}</span> / [-100, +100]<br><br>`;

        if (edge.momentum > 50) { m += `🟢 <span class="msg-highlight">MOMENTUM MẠNH</span><br>Kết quả gần đây rất tích cực. Hệ thống tăng nhẹ 5% sizing.<br><br>`; m += `💡 <em>Tốt! Nhưng đừng chủ quan. Momentum có thể đảo chiều bất kỳ lúc nào.</em>`; }
        else if (edge.momentum > 20) { m += `🟢 Momentum tích cực. Xu hướng tốt. Tiếp tục.<br><br>`; m += `💡 <em>Giữ kỷ luật, đừng tăng cược vì thấy "thuận".</em>`; }
        else if (edge.momentum > -20) { m += `➡️ Trung tính. Không có xu hướng rõ. Cược bình thường.<br><br>`; m += `💡 <em>Đây là trạng thái phổ biến nhất. Không cần thay đổi gì.</em>`; }
        else if (edge.momentum > -50) { m += `🟡 Momentum tiêu cực. Hệ thống giảm 15% sizing.<br><br>`; m += `💡 <em>Giảm tốc tự nhiên. Đừng cố gỡ bằng cách tăng cược.</em>`; }
        else { m += `<span class="msg-warn">🔴 MOMENTUM RẤT TIÊU CỰC</span><br>Hệ thống giảm 15% sizing + cảnh báo rủi ro.<br><br>`; m += `💡 <em>Cân nhắc nghỉ ngắn. Reset tâm lý trước khi tiếp.</em>`; }

        return m;
    }

    function genTilt(s, tilt, streak) {
        let m = `🧠 <strong>PHÂN TÍCH TÂM LÝ</strong><br><br>`;

        if (!tilt.isTilting) {
            m += `<span class="msg-highlight">✅ Không phát hiện dấu hiệu TILT</span><br>`;
            m += `Điểm tilt: ${tilt.severity}/100<br><br>`;
            m += `Bạn đang kiểm soát tốt cảm xúc. Tiếp tục giữ nhịp!<br><br>`;
        } else {
            m += `<span class="msg-warn">⚠️ PHÁT HIỆN DẤU HIỆU TILT (${tilt.severity}/100)</span><br><br>`;
            m += `Tín hiệu:<br>`;
            tilt.signals.forEach(s => { m += `• <span class="msg-warn">${s}</span><br>`; });
            m += `<br>`;
        }

        m += `📋 <strong>3 quy tắc tâm lý:</strong><br>`;
        m += `1. 🧘 Không cược khi đang tức/buồn/hưng phấn quá<br>`;
        m += `2. 📏 Tuân thủ sizing hệ thống, KHÔNG tự ý tăng<br>`;
        m += `3. ⏸️ Nghỉ 15 phút sau mỗi 5 lệnh liên tiếp<br><br>`;
        m += `💡 <em>80% lỗ lệch hệ thống đến từ cảm xúc, không phải xác suất.</em>`;

        return m;
    }

    function genTime(s, time) {
        let m = `⏰ <strong>PHÂN TÍCH KHUNG GIỜ</strong><br><br>`;

        if (!time.bestPeriod) {
            m += `Cần thêm dữ liệu (≥10 lệnh phân bổ nhiều khung giờ) để phân tích.<br><br>`;
            m += `💡 <em>Ghi chép thời gian mỗi lệnh để hệ thống phát hiện pattern!</em>`;
            return m;
        }

        if (time.bestPeriod) m += `🟢 Khung giờ tốt nhất: <span class="msg-highlight">${time.bestPeriod.period}</span> (WR ${(time.bestPeriod.wr * 100).toFixed(0)}%, ${time.bestPeriod.total} lệnh)<br>`;
        if (time.worstPeriod) m += `🔴 Khung giờ tệ nhất: <span class="msg-warn">${time.worstPeriod.period}</span> (WR ${(time.worstPeriod.wr * 100).toFixed(0)}%, ${time.worstPeriod.total} lệnh)<br>`;
        if (time.currentPeriodAdvice) m += `<br>${time.currentPeriodAdvice}<br>`;

        m += `<br>💡 <em>Tập trung cược vào khung giờ có WR cao nhất!</em>`;
        return m;
    }

    function genMotivation(s, stats, motivation) {
        const extras = [
            '🎯 "Kỷ luật là cầu nối giữa mục tiêu và thành tựu."',
            '💎 "Không phải người thắng nhiều nhất sẽ thắng cuối cùng, mà là người giữ được vốn."',
            '🧮 "Xác suất không biết nói dối. Hãy tin vào toán học."',
            '🛡️ "Bảo toàn vốn > Tăng vốn. Mất vốn = hết game."',
            '🔥 "Mỗi lệnh đúng quy trình là một bước tiến, dù thắng hay thua."',
            '🧘 "Người chơi giỏi nhất không phải người may mắn nhất, mà là người kỷ luật nhất."',
            '📊 "Đừng để 1 lệnh thua phá hỏng 10 lệnh thắng. Quản lý rủi ro là vua."',
        ];

        let m = `🔥 <strong>ĐỘNG LỰC</strong><br><br>`;
        m += `${motivation}<br><br>`;

        // Pick 2 random extras
        const shuffled = extras.sort(() => 0.5 - Math.random());
        m += `${shuffled[0]}<br><br>${shuffled[1]}`;

        if (stats.total > 0 && stats.profitPct > 0) {
            m += `<br><br>📈 Bạn đang có lãi <span class="msg-highlight">+${stats.profitPct.toFixed(1)}%</span>! Tiếp tục giữ kỷ luật — bạn đang trên đường đúng! 💪`;
        } else if (stats.total > 0) {
            m += `<br><br>🛡️ Đang lỗ không có nghĩa là sai hướng. Nếu WR ${stats.wr.toFixed(0)}% > 53%, thời gian sẽ đứng về phía bạn. Kiên nhẫn! 💪`;
        }

        return m;
    }

    // ===== UTILITIES =====
    function riskBadge(level) {
        if (level === 'LOW') return '<span class="msg-highlight">THẤP ✅</span>';
        if (level === 'MEDIUM') return '<span style="color:#ffb74d;font-weight:600">TRUNG BÌNH ⚠️</span>';
        if (level === 'HIGH') return '<span class="msg-warn">CAO ❌</span>';
        return '<span class="msg-warn">DỪNG NGAY 🛑</span>';
    }

    function isOffTopic(q) {
        const off = ['thời tiết', 'weather', 'nấu ăn', 'cooking', 'chính trị', 'politics', 'code', 'lập trình', 'programming', 'phim', 'movie', 'nhạc', 'music', 'hack', 'cheat', 'tình yêu', 'love', 'triết học', 'toán học', 'lịch sử', 'history', 'minecraft', 'fortnite', 'valorant', 'facebook', 'tiktok', 'instagram', 'youtube', 'bitcoin', 'crypto', 'forex', 'chứng khoán', 'ai là', 'who is', 'bạn là ai', 'tên gì'];
        const on = ['cược', 'bet', 'vốn', 'bankroll', 'thắng', 'thua', 'win', 'loss', 'kelly', 'odds', 'rủi ro', 'risk', 'chiến thuật', 'strategy', 'lệnh', 'chuỗi', 'streak', 'roi', 'ev', 'expected', 'dừng', 'stop', 'mục tiêu', 'target', 'lãi', 'lỗ', 'profit', 'tình trạng', 'status', 'tiếp theo', 'next', 'gợi ý', 'tư vấn', 'khuyến nghị', 'esport', 'dota', 'lol', 'rồng', 'dragon', 'kèo', 'rate', 'phân tích', 'quản lý', 'bảo toàn', 'tối ưu', 'hiệu suất', 'momentum', 'tilt', 'cảm xúc', 'tâm lý', 'xác suất', 'bayesian', 'edge', 'sizing', 'thời gian', 'khung giờ', 'động lực'];
        if (on.some(p => q.includes(p))) return false;
        return off.some(p => q.includes(p));
    }

    function matches(q, keywords) { return keywords.some(k => q.includes(k)); }

    function addBotMessage(html) {
        const c = document.getElementById('chatMessages');
        const d = document.createElement('div');
        d.className = 'chat-msg bot';
        d.innerHTML = html;
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }

    function addUserMessage(text) {
        const c = document.getElementById('chatMessages');
        const d = document.createElement('div');
        d.className = 'chat-msg user';
        d.textContent = text;
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }

    function showTyping() {
        const c = document.getElementById('chatMessages');
        const d = document.createElement('div');
        d.className = 'chat-typing';
        d.id = 'typingIndicator';
        d.innerHTML = '<span></span><span></span><span></span>';
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }

    function removeTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

})();
