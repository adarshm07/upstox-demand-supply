const TelegramBot = require('node-telegram-bot-api');
const config = require('../../config');
const logger = require('../utils/logger');

class TelegramTradeBot {
    constructor() {
        // polling: true listens for user replies
        this.bot = new TelegramBot(config.telegram.token, { polling: true });
        this.chatId = config.telegram.chatId;

        // Pending confirmations map: messageId → { resolve, reject, timer }
        this.pending = new Map();

        this._listenForReplies();
        logger.info('📱 Telegram bot started and listening...');
        // ── /pnl ── Today's P&L ───────────────────────
        this.bot.onText(/\/pnl(?:\s+(\w+))?/, async (msg, match) => {
            await this._handlePnL('today', match?.[1]?.toUpperCase());
        });

        // ── /pnlweek ── This week ──────────────────────
        this.bot.onText(/\/pnlweek/, async () => {
            await this._handlePnL('week');
        });

        // ── /pnlmonth ── This month ────────────────────
        this.bot.onText(/\/pnlmonth/, async () => {
            await this._handlePnL('month');
        });

        // ── /pnlall ── All time ────────────────────────
        this.bot.onText(/\/pnlall/, async () => {
            await this._handlePnL('all');
        });

        // ── /trades ── List open paper trades ──────────
        this.bot.onText(/\/trades/, async () => {
            await this._handleOpenTrades();
        });

        // ── /capital ── Show capital config ────────────
        this.bot.onText(/\/capital/, async () => {
            await this._handleCapitalInfo();
        });

        // ── /help ── Command list ──────────────────────
        this.bot.onText(/\/help/, async () => {
            await this.sendMessage(
                `*📋 Bot Commands*\n` +
                `━━━━━━━━━━━━━━━\n` +
                `\`/pnl\`         — Today's P&L\n` +
                `\`/pnl RELIANCE\` — P&L for one stock\n` +
                `\`/pnlweek\`     — This week\n` +
                `\`/pnlmonth\`    — Last 30 days\n` +
                `\`/pnlall\`      — All time\n` +
                `\`/trades\`      — Open paper trades\n` +
                `\`/capital\`     — Capital config\n` +
                `\`/status\`      — Bot status\n`
            );
        });
    }

    // ─────────────────────────────────────────────
    // SEND any message (no confirmation needed)
    // ─────────────────────────────────────────────
    async sendMessage(text) {
        return this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
    }

    // ─────────────────────────────────────────────
    // SEND TRADE ALERT + wait for YES / NO reply
    // Returns: true (approved) | false (rejected/timeout)
    // ─────────────────────────────────────────────
    async requestConfirmation(tradeDetails) {
        const {
            symbol, type, entry, sl, tp, qty,
            rr, pattern, zone, conditions
        } = tradeDetails;

        const emoji = type === 'BUY' ? '🟢' : '🔴';
        const zoneType = zone.type === 'demand' ? '🔵 Demand' : '🔴 Supply';
        const capital = (qty * entry).toLocaleString('en-IN');
        const risk = ((entry - sl) * qty).toFixed(0);
        const reward = ((tp - entry) * qty).toFixed(0);

        const message =
            `${emoji} *TRADE SIGNAL — ${symbol}*
━━━━━━━━━━━━━━━━━━━━
📌 *Zone:* ${zoneType} [${zone.low.toFixed(1)} – ${zone.high.toFixed(1)}]
📈 *Direction:* ${type}
💰 *Entry:* ₹${entry}
🛑 *Stop Loss:* ₹${sl}
🎯 *Target:* ₹${tp}
📊 *R:R Ratio:* 1:${rr}
🕯 *Pattern:* ${pattern}
📦 *Quantity:* ${qty} shares
💵 *Capital Used:* ₹${capital}
⚠️ *Risk:* ₹${risk} | *Reward:* ₹${reward}
━━━━━━━━━━━━━━━━━━━━
✅ *Conditions Passed:* ${conditions.passed}/10
━━━━━━━━━━━━━━━━━━━━
⏱ Reply within ${config.telegram.confirmTimeout}s
👉 /yes — Place order
👉 /no  — Skip trade`;

        // Send with inline keyboard buttons
        const sent = await this.bot.sendMessage(this.chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ YES — Place Order', callback_data: `confirm_yes_${sent_placeholder}` },
                    { text: '❌ NO  — Skip', callback_data: `confirm_no_${sent_placeholder}` },
                ]],
            },
        });

        // Re-send with correct message ID in callback data
        await this.bot.deleteMessage(this.chatId, sent.message_id);

        const final = await this.bot.sendMessage(this.chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ YES — Place Order', callback_data: `yes_${final_placeholder}` },
                    { text: '❌ NO  — Skip', callback_data: `no_${final_placeholder}` },
                ]],
            },
        });

        return this._waitForConfirmation(final.message_id, symbol);
    }

    // ─────────────────────────────────────────────
    // SEND TRADE ALERT (cleaner two-step approach)
    // ─────────────────────────────────────────────
    async requestTradeConfirmation(tradeDetails) {
        const {
            symbolName: symbol, type, entry, sl, tp, qty,
            rr, pattern, zone, conditionLog
        } = tradeDetails;

        const emoji = type === 'BUY' ? '🟢' : '🔴';
        const zoneType = zone.type === 'demand' ? '🔵 Demand' : '🔴 Supply';
        const capital = (qty * entry).toLocaleString('en-IN');
        const riskAmt = Math.abs((entry - sl) * qty).toFixed(0);
        const rewardAmt = Math.abs((tp - entry) * qty).toFixed(0);

        const message =
            `${emoji} *TRADE SIGNAL — ${symbol}*
━━━━━━━━━━━━━━━━━━━━
📌 *Zone:* ${zoneType} [${zone.low.toFixed(1)} – ${zone.high.toFixed(1)}]
📈 *Direction:* ${type}
💰 *Entry:* ₹${entry}
🛑 *Stop Loss:* ₹${sl}
🎯 *Target:* ₹${tp}
📊 *R:R:* 1:${rr}
🕯 *Pattern:* ${pattern || 'N/A'}
📦 *Qty:* ${qty} shares
💵 *Capital:* ₹${capital}
⚠️ *Risk:* ₹${riskAmt} | *Reward:* ₹${rewardAmt}
━━━━━━━━━━━━━━━━━━━━
${conditionLog}
━━━━━━━━━━━━━━━━━━━━
⏱ _Auto-skip in ${config.telegram.confirmTimeout}s_`;

        // Send message with YES/NO inline buttons
        const sent = await this.bot.sendMessage(this.chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅  YES – Place Order', callback_data: 'YES:0' },
                    { text: '❌  NO – Skip', callback_data: 'NO:0' },
                ]],
            },
        });

        // Now update the callback_data with the real message_id
        await this.bot.editMessageReplyMarkup(
            {
                inline_keyboard: [[
                    { text: '✅  YES – Place Order', callback_data: `YES:${sent.message_id}` },
                    { text: '❌  NO – Skip', callback_data: `NO:${sent.message_id}` },
                ]],
            },
            { chat_id: this.chatId, message_id: sent.message_id }
        );

        return this._waitForConfirmation(sent.message_id, symbol);
    }

    // ─────────────────────────────────────────────
    // WAIT FOR BUTTON PRESS — returns Promise<bool>
    // ─────────────────────────────────────────────
    _waitForConfirmation(messageId, symbol) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pending.delete(messageId);
                this.sendMessage(`⏱ *${symbol}* — No response. Trade skipped.`);
                logger.warn(`Telegram timeout for ${symbol} — auto-skipped`);
                resolve(false);
            }, config.telegram.confirmTimeout * 1000);

            this.pending.set(messageId, { resolve, timer, symbol });
        });
    }

    // ─────────────────────────────────────────────
    // LISTEN for button presses (callback_query)
    // ─────────────────────────────────────────────
    _listenForReplies() {
        this.bot.on('callback_query', async (query) => {
            const [action, msgId] = query.data.split(':');

            // ── Close trade button ──────────────────
            if (action === 'CLOSE') {
                const orderManager = require('../orders/orderManager');
                await this.bot.answerCallbackQuery(query.id, { text: '🔄 Closing...' });
                await this.bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    { chat_id: this.chatId, message_id: query.message.message_id }
                );
                const result = await orderManager.manualClose(msgId);
                if (!result.success) {
                    await this.sendMessage(`❗ Close failed: ${result.reason.replace(/_/g, '\\_')}`);
                }
                return;
            }

            const messageId = parseInt(msgId);
            const pending = this.pending.get(messageId);

            if (!pending) return; // Unknown or expired

            clearTimeout(pending.timer);
            this.pending.delete(messageId);

            // Remove inline buttons after reply
            await this.bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                { chat_id: this.chatId, message_id: messageId }
            );

            if (action === 'YES') {
                await this.bot.answerCallbackQuery(query.id, { text: '✅ Order confirmed!' });
                await this.sendMessage(`✅ *${pending.symbol}* — Order placed!`);
                logger.info(`Telegram: User confirmed trade for ${pending.symbol}`);
                pending.resolve(true);
            } else {
                await this.bot.answerCallbackQuery(query.id, { text: '❌ Trade skipped.' });
                await this.sendMessage(`❌ *${pending.symbol}* — Trade skipped by user.`);
                logger.info(`Telegram: User rejected trade for ${pending.symbol}`);
                pending.resolve(false);
            }
        });

        // Also support /yes and /no text commands as fallback
        this.bot.onText(/\/yes/, () => {
            const lastPending = [...this.pending.values()].pop();
            if (lastPending) {
                clearTimeout(lastPending.timer);
                lastPending.resolve(true);
                this.pending.clear();
            }
        });

        this.bot.onText(/\/no/, () => {
            const lastPending = [...this.pending.values()].pop();
            if (lastPending) {
                clearTimeout(lastPending.timer);
                lastPending.resolve(false);
                this.pending.clear();
            }
        });

        // /status command — show bot health
        this.bot.onText(/\/status/, async () => {
            await this.sendMessage(
                `🤖 *Bot Status*\n` +
                `✅ Running\n` +
                `⏰ ${new Date().toLocaleTimeString('en-IN')}\n` +
                `📊 Pending confirmations: ${this.pending.size}`
            );
        });
    }

    // ─────────────────────────────────────────────
    // NOTIFY: Order result after placement
    // ─────────────────────────────────────────────
    async notifyOrderResult({ symbol, success, orderId, error }) {
        if (success) {
            await this.sendMessage(
                `🎉 *Order Executed*\n` +
                `📌 ${symbol}\n` +
                `🆔 Order ID: \`${orderId}\``
            );
        } else {
            await this.sendMessage(
                `❗ *Order Failed*\n` +
                `📌 ${symbol}\n` +
                `⚠️ ${error}`
            );
        }
    }

    // Send daily summary
    async sendDailySummary({ trades, pnl, wins, losses }) {
        const emoji = pnl >= 0 ? '📈' : '📉';
        await this.sendMessage(
            `${emoji} *Daily Summary*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📊 Total Trades: ${trades}\n` +
            `✅ Wins: ${wins} | ❌ Losses: ${losses}\n` +
            `💰 Net P&L: ₹${pnl.toLocaleString('en-IN')}`
        );
    }

    // ─────────────────────────────────────────────
    // HANDLER: Fetch and format P&L from DB
    // ─────────────────────────────────────────────
    async _handlePnL(period, symbolName = null) {
        const paperTrader = require('../paper/paperTrader');     // avoid circular
        const s = await paperTrader.getPnLSummary({ period, symbolName });

        const emoji = s.totalPnL >= 0 ? '📈' : '📉';
        const pnlStr = s.totalPnL >= 0
            ? `+₹${s.totalPnL.toLocaleString('en-IN')}`
            : `-₹${Math.abs(s.totalPnL).toLocaleString('en-IN')}`;

        const periodLabel = {
            today: "Today", week: "This Week", month: "Last 30 Days", all: "All Time"
        }[period] || period;

        // Symbol breakdown
        let symbolLines = '';
        for (const [sym, data] of Object.entries(s.bySymbol)) {
            const symEmoji = data.pnl >= 0 ? '🟢' : '🔴';
            symbolLines += `  ${symEmoji} ${sym}: ₹${data.pnl.toFixed(0)} (${data.wins}/${data.trades} wins)\n`;
        }

        const message =
            `${emoji} *Paper Trade P&L — ${periodLabel}*\n` +
            (symbolName ? `📌 Symbol: ${symbolName}\n` : '') +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💰 Net P&L: *${pnlStr}* (${s.pnlPct}%)\n` +
            `📊 Trades: ${s.closed} closed, ${s.open} open\n` +
            `✅ Wins: ${s.wins} | ❌ Losses: ${s.losses}\n` +
            `🎯 Win Rate: ${s.winRate}%\n` +
            `📐 Avg R:R: 1:${s.avgRR}\n` +
            (s.best ? `🏆 Best:  ${s.best.symbol} ₹${s.best.pnl}\n` : '') +
            (s.worst ? `💀 Worst: ${s.worst.symbol} ₹${s.worst.pnl}\n` : '') +
            `━━━━━━━━━━━━━━━━━━\n` +
            (symbolLines ? `*By Symbol:*\n${symbolLines}` : '');

        await this.sendMessage(message);
    }

    // ─────────────────────────────────────────────
    // HANDLER: List open paper trades
    // ─────────────────────────────────────────────
    async _handleOpenTrades() {
        const Trade = require('../db/models/Trade');
        const broker = require('../broker/upstox');

        const open = await Trade.find({ status: 'open', mode: 'paper' });

        if (!open.length) {
            await this.sendMessage('📭 No open paper trades right now.');
            return;
        }

        for (const t of open) {
            const ltp = await broker.getLTP(t.instrumentKey) || '—';
            const entry = parseFloat(t.entryPrice);
            const unrealPnL = typeof ltp === 'number'
                ? ((t.type === 'BUY' ? ltp - entry : entry - ltp) * t.qty).toFixed(0)
                : '—';
            const pnlEmoji = typeof unrealPnL === 'number' && unrealPnL >= 0 ? '🟢' : '🔴';

            const msg =
                `${pnlEmoji} *${t.symbolName}* ${t.type}\n` +
                `Entry: ₹${entry} | LTP: ₹${ltp}\n` +
                `SL: ₹${t.sl} | TP: ₹${t.tp}\n` +
                `Unrealised P&L: ₹${unrealPnL}`;

            await this.bot.sendMessage(this.chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔒 Close Trade', callback_data: `CLOSE:${t._id}` },
                    ]],
                },
            });
        }
    }

    // ─────────────────────────────────────────────
    // HANDLER: Show capital config
    // ─────────────────────────────────────────────
    async _handleCapitalInfo() {
        const cfg = config.capital;
        const modeDescriptions = {
            fixed: `Fixed ₹${cfg.perTrade.toLocaleString('en-IN')} per trade`,
            percent: `${cfg.pctPerTrade}% of total capital (₹${(cfg.total * cfg.pctPerTrade / 100).toLocaleString('en-IN')} per trade)`,
            risk: `Risk-based — max ${cfg.maxRiskPct}% risk per trade`,
        };

        await this.sendMessage(
            `💰 *Capital Configuration*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `Total Capital: ₹${cfg.total.toLocaleString('en-IN')}\n` +
            `Mode: \`${cfg.mode}\`\n` +
            `Rule: ${modeDescriptions[cfg.mode]}\n` +
            `Max Daily Loss: ${cfg.maxDailyLossPct}%\n` +
            `Max Open Trades: ${cfg.maxOpenTrades}\n` +
            `\n_Change via .env and restart bot_`
        );
    }
}

module.exports = new TelegramTradeBot();