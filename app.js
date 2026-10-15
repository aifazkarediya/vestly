const COLUMNS = [
            { key: 'month',       colLetter: 'A', label: 'Month',             editable: true,  type: 'text' },
            { key: 'startingBal', colLetter: 'B', label: 'Starting Bal ($)',  editable: 'row0_or_override', type: 'currency' },
            { key: 'addingBal',   colLetter: 'C', label: 'Adding Bal ($)',    editable: true,  type: 'currency' },
            { key: 'returnPct',   colLetter: 'D', label: 'Percentage Return', editable: true,  type: 'percent' },
            { key: 'grossProfit', colLetter: 'E', label: 'Gross Profit ($)',  editable: false, type: 'currency' },
            { key: 'withdrawals', colLetter: 'F', label: 'Withdrawals ($)',   editable: true,  type: 'currency' },
            { key: 'netProfit',   colLetter: 'G', label: 'Net Profit ($)',    editable: false, type: 'currency' },
            { key: 'endingBal',   colLetter: 'H', label: 'Ending Bal ($)',    editable: false, type: 'currency' }
        ];

        const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const MONTH_NAMES_LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        let rows = [];
        let activeSelection = { rowIndex: 0, colKey: 'startingBal' };
        let monthConfig = { intervalMonths: 1, format: 'MMM YYYY', autoCascadeOnEdit: true };

        let undoSnapshot = null;
        let cellEditSession = null;
        let toastTimer = null;

        const usdFormat = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        function formatUSD(val, showPlus = false) {
            const num = Number(val) || 0;
            const formatted = usdFormat.format(num);
            if (showPlus && num > 0) return '+' + formatted;
            return formatted;
        }

        const currencyInputFormat = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false
        });
        function formatCurrencyInput(value) {
            return currencyInputFormat.format(Number(value) || 0);
        }

        function formatPct(val) {
            const num = Number(val) || 0;
            return num.toFixed(2) + '%';
        }

        function saveUndoSnapshot(actionLabel) {
            undoSnapshot = {
                rows: JSON.parse(JSON.stringify(rows)),
                monthConfig: { ...monthConfig },
                label: actionLabel
            };
            updateTopUndoButton();
        }

        function updateTopUndoButton() {
            const btn = document.getElementById('topUndoBtn');
            if (!btn) return;
            btn.disabled = !undoSnapshot;
            if (undoSnapshot) {
                btn.classList.remove('opacity-50', 'pointer-events-none', 'text-slate-500');
                btn.classList.add('text-slate-800', 'bg-blue-50', 'border', 'border-blue-200');
            } else {
                btn.classList.add('opacity-50', 'pointer-events-none', 'text-slate-500');
                btn.classList.remove('text-slate-800', 'bg-blue-50', 'border', 'border-blue-200');
            }
        }

        function undoLastAction() {
            if (!undoSnapshot) return;
            cellEditSession = null;
            rows = JSON.parse(JSON.stringify(undoSnapshot.rows));
            monthConfig = { ...undoSnapshot.monthConfig };
            updateColAHeaderBadge();
            recalculateSpreadsheet();
            renderSpreadsheet();
            const restoredLabel = undoSnapshot.label || 'previous state';
            undoSnapshot = null;
            updateTopUndoButton();
            showToast(`Restored: ${restoredLabel}`, false);
        }

        function showToast(msg, allowUndo = false) {
            const toast = document.getElementById('toast');
            const undoBtn = document.getElementById('toastUndoBtn');
            document.getElementById('toastMessage').textContent = msg;

            if (allowUndo && undoSnapshot) {
                undoBtn.classList.remove('hidden');
            } else {
                undoBtn.classList.add('hidden');
            }

            toast.classList.remove('translate-y-20', 'opacity-0');
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0');
            }, allowUndo ? 5000 : 2400);
        }

        function formatDateByPattern(dateObj, formatPattern = monthConfig.format) {
            const m = dateObj.getMonth();
            const y = dateObj.getFullYear();
            const mm = String(m + 1).padStart(2, '0');
            switch (formatPattern) {
                case 'MMMM YYYY': return `${MONTH_NAMES_LONG[m]} ${y}`;
                case 'MM/YYYY': return `${mm}/${y}`;
                case 'YYYY-MM': return `${y}-${mm}`;
                case 'MMM YYYY':
                default: return `${MONTH_NAMES_SHORT[m]} ${y}`;
            }
        }

        function parseFlexibleMonthString(rawStr) {
            if (!rawStr || typeof rawStr !== 'string') return null;
            const s = rawStr.trim();
            const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})$/);
            if (isoMatch) {
                const year = parseInt(isoMatch[1], 10);
                const monthIdx = parseInt(isoMatch[2], 10) - 1;
                if (monthIdx >= 0 && monthIdx <= 11) return { year, monthIndex: monthIdx, detectedFormat: 'YYYY-MM' };
            }
            const slashMatch = s.match(/^(\d{1,2})[-/](\d{4})$/);
            if (slashMatch) {
                const monthIdx = parseInt(slashMatch[1], 10) - 1;
                const year = parseInt(slashMatch[2], 10);
                if (monthIdx >= 0 && monthIdx <= 11) return { year, monthIndex: monthIdx, detectedFormat: 'MM/YYYY' };
            }
            const nameMatch = s.match(/^([A-Za-z]+)\s*,?\s*(\d{2,4})$/);
            if (nameMatch) {
                const namePart = nameMatch[1].toLowerCase();
                let year = parseInt(nameMatch[2], 10);
                if (year < 100) year += 2000;
                const longIdx = MONTH_NAMES_LONG.findIndex(m => m.toLowerCase() === namePart);
                if (longIdx !== -1) return { year, monthIndex: longIdx, detectedFormat: 'MMMM YYYY' };
                const shortIdx = MONTH_NAMES_SHORT.findIndex(m => namePart.startsWith(m.toLowerCase()));
                if (shortIdx !== -1) return { year, monthIndex: shortIdx, detectedFormat: 'MMM YYYY' };
            }
            const fallback = Date.parse(s + ' 1');
            if (!isNaN(fallback)) {
                const d = new Date(fallback);
                return { year: d.getFullYear(), monthIndex: d.getMonth(), detectedFormat: monthConfig.format };
            }
            return null;
        }

        function getNextMonthLabel(prevLabel, stepMonths = monthConfig.intervalMonths, formatPattern = monthConfig.format) {
            const parsed = parseFlexibleMonthString(prevLabel);
            if (parsed) {
                const d = new Date(parsed.year, parsed.monthIndex + stepMonths, 1);
                return formatDateByPattern(d, formatPattern);
            }
            return `Month ${rows.length + 1}`;
        }

        function updateColAHeaderBadge() {
            const badge = document.getElementById('colAMetaLabel');
            if (!badge) return;
            const stepMap = { 1: '+1M', 3: '+3M', 6: '+6M', 12: '+1Y' };
            badge.textContent = `${monthConfig.format} • ${stepMap[monthConfig.intervalMonths] || '+1M'}`;
        }

        function loadSampleData() {
            if (rows.length > 0) saveUndoSnapshot('Reset to Default Schedule');
            rows = [];
            monthConfig.intervalMonths = 1;
            monthConfig.format = 'MMM YYYY';
            updateColAHeaderBadge();

            const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1); // Current month
            for (let i = 0; i < 12; i++) {
                const d = new Date(start.getFullYear(), start.getMonth() + (i * monthConfig.intervalMonths), 1);
                const monthStr = formatDateByPattern(d, monthConfig.format);
                rows.push({
                    month: monthStr,
                    startingBal: i === 0 ? 10000 : 0,
                    overrideStarting: false,
                    addingBal: i === 0 ? 0 : 500,
                    returnPct: 4.50,
                    grossProfit: 0,
                    withdrawals: (i + 1) % 3 === 0 ? 250 : 0,
                    netProfit: 0,
                    endingBal: 0
                });
            }
            recalculateSpreadsheet();
            renderSpreadsheet();
            selectCell(0, 'startingBal', false);
            showToast('Loaded default 12-month USD investment schedule', Boolean(undoSnapshot));
        }

        function recalculateSpreadsheet() {
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                if (i > 0 && !r.overrideStarting) {
                    r.startingBal = rows[i - 1].endingBal;
                }
                const startBal = Number(r.startingBal) || 0;
                const addBal = Number(r.addingBal) || 0;
                const pct = Number(r.returnPct) || 0;
                const withdraw = Number(r.withdrawals) || 0;

                const activeCapital = startBal + addBal;
                const gross = activeCapital * (pct / 100);
                const net = gross - withdraw;
                const ending = startBal + addBal + net;

                r.grossProfit = gross;
                r.netProfit = net;
                r.endingBal = ending;
            }
            updateSummaryAndKPIs();
            saveSchedule();
        }

        function updateSummaryAndKPIs() {
            const initialCap = rows.length > 0 ? (Number(rows[0].startingBal) || 0) : 0;
            let totalAdded = 0;
            let totalGross = 0;
            let totalWithdrawals = 0;
            let totalNet = 0;
            let sumReturnPct = 0;

            rows.forEach(r => {
                totalAdded += Number(r.addingBal) || 0;
                totalGross += Number(r.grossProfit) || 0;
                totalWithdrawals += Number(r.withdrawals) || 0;
                totalNet += Number(r.netProfit) || 0;
                sumReturnPct += Number(r.returnPct) || 0;
            });

            const finalEnd = rows.length > 0 ? rows[rows.length - 1].endingBal : 0;
            const avgReturn = rows.length > 0 ? (sumReturnPct / rows.length) : 0;
            const totalInvested = initialCap + totalAdded;
            const totalROI = totalInvested > 0 ? ((totalNet / totalInvested) * 100) : 0;

            document.getElementById('kpiInitial').textContent = formatUSD(initialCap);
            document.getElementById('kpiTotalAdded').textContent = formatUSD(totalAdded, true); // Neutral black KPI
            document.getElementById('kpiTotalGross').textContent = formatUSD(totalGross, true);
            document.getElementById('kpiTotalWithdrawals').textContent = totalWithdrawals > 0 ? '-' + formatUSD(totalWithdrawals) : '$0.00';
            document.getElementById('kpiTotalNet').textContent = formatUSD(totalNet, true);
            document.getElementById('kpiFinalBalance').textContent = formatUSD(finalEnd);
            document.getElementById('kpiTotalROI').textContent = (totalROI >= 0 ? '+' : '') + totalROI.toFixed(1) + '% Net ROI';

            document.getElementById('footStarting').textContent = formatUSD(initialCap);
            document.getElementById('footAdding').textContent = formatUSD(totalAdded, true); // Neutral black footer summary
            document.getElementById('footAvgReturn').textContent = formatPct(avgReturn) + ' avg';
            document.getElementById('footGross').textContent = formatUSD(totalGross, true);
            document.getElementById('footWithdrawals').textContent = totalWithdrawals > 0 ? '-' + formatUSD(totalWithdrawals) : '$0.00';
            document.getElementById('footNet').textContent = formatUSD(totalNet, true);
            document.getElementById('footEnding').textContent = formatUSD(finalEnd);

            document.getElementById('statusRowCount').textContent = `Rows: ${rows.length}`;
        }

        function escapeHTML(value) {
            return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function renderSpreadsheet() {
            const tbody = document.getElementById('sheetBody');
            tbody.innerHTML = rows.map((r, rIdx) => {
                const rowNum = rIdx + 1;
                const isStartingAuto = rIdx > 0 && !r.overrideStarting;
                return `
                    <tr id="sheet-row-${rIdx}" class="hover:bg-slate-50/60 transition-colors group">
                        <td data-action="selectCell" data-select-row="${rIdx}" data-select-col="month" data-select-focus="true" class="row-index-cell py-2 px-2 text-center font-mono text-xs text-slate-400 bg-slate-50 select-none cursor-pointer">
                            ${rowNum}
                        </td>
                        <td id="cell-${rIdx}-month" data-action="selectCell" data-select-row="${rIdx}" data-select-col="month" data-select-focus="true" class="p-0 bg-white cursor-text relative group/month">
                            <div class="flex items-center pr-1">
                                <input type="text" data-row="${rIdx}" data-col="month" value="${escapeHTML(r.month)}"
                                    
                                    
                                    
                                    class="w-full h-full py-2 pl-3 pr-1 bg-transparent font-sans font-semibold text-slate-800 focus:outline-none">
                                <button type="button" data-action="fillMonthSeriesFromRow" data-number="${rIdx}"
                                    title="Fill sequential months down from Row ${rowNum}"
                                    class="opacity-0 group-hover/month:opacity-100 focus:opacity-100 p-1 rounded hover:bg-blue-50 text-blue-600 transition shrink-0 no-print">
                                    <i class="ph-bold ph-arrow-line-down text-xs"></i>
                                </button>
                            </div>
                        </td>
                        <td id="cell-${rIdx}-startingBal" data-action="selectCell" data-select-row="${rIdx}" data-select-col="startingBal" data-select-focus="true"
                            class="p-0 ${isStartingAuto ? 'bg-slate-50/70' : 'bg-white'} cursor-text relative">
                            <div class="flex items-center justify-between px-3 py-2">
                                ${isStartingAuto
                                    ? `<span class="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-500" title="Auto-linked from H${rIdx}. Click to override">=H${rIdx}</span>`
                                    : `<span class="text-slate-400 select-none">$</span>`
                                }
                                <input type="number" step="0.01" data-row="${rIdx}" data-col="startingBal"
                                    value="${formatCurrencyInput(r.startingBal)}"
                                    
                                    
                                    
                                    class="w-full bg-transparent text-right font-semibold ${isStartingAuto ? 'text-slate-600' : 'text-slate-900'} focus:outline-none">
                            </div>
                        </td>
                        <td id="cell-${rIdx}-addingBal" data-action="selectCell" data-select-row="${rIdx}" data-select-col="addingBal" data-select-focus="true" class="p-0 bg-indigo-50/15 cursor-text">
                            <div class="flex items-center justify-between px-3 py-2">
                                <span class="text-indigo-400 select-none">+$</span>
                                <input type="number" step="0.01" data-row="${rIdx}" data-col="addingBal"
                                    value="${formatCurrencyInput(r.addingBal)}"
                                    
                                    
                                    
                                    class="w-full bg-transparent text-right font-semibold ${r.addingBal > 0 ? 'text-indigo-900' : 'text-slate-400'} focus:outline-none">
                            </div>
                        </td>
                        <td id="cell-${rIdx}-returnPct" data-action="selectCell" data-select-row="${rIdx}" data-select-col="returnPct" data-select-focus="true" class="p-0 bg-blue-50/15 cursor-text">
                            <div class="flex items-center justify-end px-3 py-2">
                                <input type="number" step="0.1" data-row="${rIdx}" data-col="returnPct"
                                    value="${Number(r.returnPct).toFixed(2)}"
                                    
                                    
                                    
                                    class="w-20 bg-transparent text-right font-semibold ${r.returnPct >= 0 ? 'text-blue-700' : 'text-rose-600'} focus:outline-none">
                                <span class="text-blue-600 ml-0.5 select-none font-semibold">%</span>
                            </div>
                        </td>
                        <td id="cell-${rIdx}-grossProfit" data-action="selectCell" data-select-row="${rIdx}" data-select-col="grossProfit" data-select-focus="false"
                            data-display="grossProfit"
                            class="py-2 px-3 text-right font-semibold bg-slate-50/90 cursor-pointer select-none ${r.grossProfit >= 0 ? 'text-blue-700' : 'text-rose-600'}">
                            ${formatUSD(r.grossProfit, true)}
                        </td>
                        <td id="cell-${rIdx}-withdrawals" data-action="selectCell" data-select-row="${rIdx}" data-select-col="withdrawals" data-select-focus="true" class="p-0 bg-rose-50/15 cursor-text">
                            <div class="flex items-center justify-between px-3 py-2">
                                <span class="text-rose-400 select-none">-$</span>
                                <input type="number" step="0.01" data-row="${rIdx}" data-col="withdrawals"
                                    value="${formatCurrencyInput(r.withdrawals)}"
                                    
                                    
                                    
                                    class="w-full bg-transparent text-right font-semibold ${r.withdrawals > 0 ? 'text-rose-600' : 'text-slate-400'} focus:outline-none">
                            </div>
                        </td>
                        <td id="cell-${rIdx}-netProfit" data-action="selectCell" data-select-row="${rIdx}" data-select-col="netProfit" data-select-focus="false"
                            data-display="netProfit"
                            class="py-2 px-3 text-right font-bold bg-slate-50/90 cursor-pointer select-none ${r.netProfit >= 0 ? 'text-blue-700' : 'text-rose-600'}">
                            ${formatUSD(r.netProfit, true)}
                        </td>
                        <td id="cell-${rIdx}-endingBal" data-action="selectCell" data-select-row="${rIdx}" data-select-col="endingBal" data-select-focus="false"
                            data-display="endingBal"
                            class="py-2 px-3 text-right font-bold bg-blue-50/30 text-slate-900 cursor-pointer select-none">
                            ${formatUSD(r.endingBal)}
                        </td>
                    </tr>
                `;
            }).join('');
            highlightSelection();
        }

        function refreshCalculatedDOM() {
            rows.forEach((r, rIdx) => {
                if (rIdx > 0 && !r.overrideStarting) {
                    const startInput = document.querySelector(`input[data-row="${rIdx}"][data-col="startingBal"]`);
                    if (startInput && document.activeElement !== startInput) {
                        startInput.value = formatCurrencyInput(r.startingBal);
                    }
                }
                const grossCell = document.getElementById(`cell-${rIdx}-grossProfit`);
                if (grossCell) {
                    grossCell.textContent = formatUSD(r.grossProfit, true);
                    grossCell.className = `py-2 px-3 text-right font-semibold bg-slate-50/90 cursor-pointer select-none ${r.grossProfit >= 0 ? 'text-blue-700' : 'text-rose-600'} ${activeSelection.rowIndex === rIdx && activeSelection.colKey === 'grossProfit' ? 'cell-active' : ''}`;
                }
                const netCell = document.getElementById(`cell-${rIdx}-netProfit`);
                if (netCell) {
                    netCell.textContent = formatUSD(r.netProfit, true);
                    netCell.className = `py-2 px-3 text-right font-bold bg-slate-50/90 cursor-pointer select-none ${r.netProfit >= 0 ? 'text-blue-700' : 'text-rose-600'} ${activeSelection.rowIndex === rIdx && activeSelection.colKey === 'netProfit' ? 'cell-active' : ''}`;
                }
                const endCell = document.getElementById(`cell-${rIdx}-endingBal`);
                if (endCell) {
                    endCell.textContent = formatUSD(r.endingBal);
                }
            });
        }

        function selectCell(rowIndex, colKey, focusInput = true) {
            if (rowIndex < 0 || rowIndex >= rows.length) return;
            activeSelection = { rowIndex, colKey };
            highlightSelection();
            updateFormulaBar();

            if (focusInput) {
                const input = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colKey}"]`);
                if (input && document.activeElement !== input) {
                    input.focus();
                    input.select();
                }
            }
        }

        function handleCellFocus(rowIndex, colKey) {
            cellEditSession = null;
            activeSelection = { rowIndex, colKey };
            highlightSelection();
            updateFormulaBar();
        }

        function highlightSelection() {
            document.querySelectorAll('.cell-active').forEach(el => el.classList.remove('cell-active'));
            document.querySelectorAll('.row-selected').forEach(el => el.classList.remove('row-selected'));
            document.querySelectorAll('.col-selected').forEach(el => el.classList.remove('col-selected'));

            const { rowIndex, colKey } = activeSelection;
            const targetCell = document.getElementById(`cell-${rowIndex}-${colKey}`);
            if (targetCell) targetCell.classList.add('cell-active');

            const targetRow = document.getElementById(`sheet-row-${rowIndex}`);
            if (targetRow) targetRow.classList.add('row-selected');

            const colMeta = COLUMNS.find(c => c.key === colKey);
            if (colMeta) {
                const colHeader = document.getElementById(`colHeader-${colMeta.colLetter}`);
                if (colHeader) colHeader.classList.add('col-selected');
            }

            if (rows[rowIndex]) {
                const activeCap = (Number(rows[rowIndex].startingBal) || 0) + (Number(rows[rowIndex].addingBal) || 0);
                document.getElementById('statusActiveCapital').textContent = `Row ${rowIndex + 1} Active Capital (B+C): ${formatUSD(activeCap)}`;
            }
        }

        function updateFormulaBar() {
            const { rowIndex, colKey } = activeSelection;
            const r = rows[rowIndex];
            if (!r) return;

            const colMeta = COLUMNS.find(c => c.key === colKey);
            const rowNum = rowIndex + 1;
            const cellRef = `${colMeta.colLetter}${rowNum}`;

            document.getElementById('cellRefBox').textContent = cellRef;
            const formulaInput = document.getElementById('formulaBarInput');
            const statusTag = document.getElementById('cellStatusTag');

            if (colKey === 'grossProfit') {
                formulaInput.value = `=(B${rowNum}+C${rowNum})*(D${rowNum}/100)   →  ${formatUSD(r.grossProfit)}`;
                formulaInput.readOnly = true;
                statusTag.textContent = 'Calculated Formula';
                statusTag.className = 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold shrink-0';
            } else if (colKey === 'netProfit') {
                formulaInput.value = `=E${rowNum}-F${rowNum}   →  ${formatUSD(r.netProfit)}`;
                formulaInput.readOnly = true;
                statusTag.textContent = 'Calculated Formula';
                statusTag.className = 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold shrink-0';
            } else if (colKey === 'endingBal') {
                formulaInput.value = `=B${rowNum}+C${rowNum}+G${rowNum}   →  ${formatUSD(r.endingBal)}`;
                formulaInput.readOnly = true;
                statusTag.textContent = 'Rollover Formula';
                statusTag.className = 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold shrink-0';
            } else if (colKey === 'startingBal' && rowIndex > 0 && !r.overrideStarting) {
                formulaInput.value = `=H${rowIndex} (Auto Roll-over: ${formatCurrencyInput(r.startingBal)})`;
                formulaInput.readOnly = false;
                statusTag.textContent = 'Auto-Rollover (Editable)';
                statusTag.className = 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold shrink-0';
            } else {
                formulaInput.value = r[colKey];
                formulaInput.readOnly = false;
                statusTag.textContent = 'Editable Input';
                statusTag.className = 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold shrink-0';
            }
        }

        function handleCellInput(rowIndex, colKey, rawValue) {
            const r = rows[rowIndex];
            if (!r) return;
            const editKey = `${rowIndex}:${colKey}`;
            if (cellEditSession !== editKey) {
                saveUndoSnapshot(`Edit ${colKey} in Row ${rowIndex + 1}`);
                cellEditSession = editKey;
            }

            if (colKey === 'month') {
                r.month = rawValue;
                const parsed = parseFlexibleMonthString(rawValue);
                if (monthConfig.autoCascadeOnEdit && parsed && rawValue.trim().length >= 6) {
                    monthConfig.format = parsed.detectedFormat || monthConfig.format;
                    updateColAHeaderBadge();
                    for (let i = rowIndex + 1; i < rows.length; i++) {
                        const stepOffset = (i - rowIndex) * monthConfig.intervalMonths;
                        const nextDate = new Date(parsed.year, parsed.monthIndex + stepOffset, 1);
                        rows[i].month = formatDateByPattern(nextDate, monthConfig.format);
                        const domInput = document.querySelector(`input[data-row="${i}"][data-col="month"]`);
                        if (domInput && document.activeElement !== domInput) {
                            domInput.value = rows[i].month;
                        }
                    }
                }
            } else {
                const numVal = parseFloat(rawValue);
                if (colKey === 'startingBal' && rowIndex > 0) {
                    r.overrideStarting = true;
                }
                r[colKey] = isNaN(numVal) ? 0 : numVal;
            }

            recalculateSpreadsheet();
            refreshCalculatedDOM();
            updateFormulaBar();
        }

        function handleCellKeydown(event, rowIndex, colKey) {
            const editableCols = ['month', 'startingBal', 'addingBal', 'returnPct', 'withdrawals'];
            const currentColIdx = editableCols.indexOf(colKey);

            if (event.key === 'Enter') {
                event.preventDefault();
                if (rowIndex + 1 < rows.length) selectCell(rowIndex + 1, colKey, true);
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (rowIndex + 1 < rows.length) selectCell(rowIndex + 1, colKey, true);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (rowIndex - 1 >= 0) selectCell(rowIndex - 1, colKey, true);
            } else if (event.key === 'Tab') {
                event.preventDefault();
                if (event.shiftKey) {
                    if (currentColIdx > 0) selectCell(rowIndex, editableCols[currentColIdx - 1], true);
                    else if (rowIndex > 0) selectCell(rowIndex - 1, editableCols[editableCols.length - 1], true);
                } else {
                    if (currentColIdx < editableCols.length - 1) selectCell(rowIndex, editableCols[currentColIdx + 1], true);
                    else if (rowIndex + 1 < rows.length) selectCell(rowIndex + 1, editableCols[0], true);
                }
            }
        }

        document.getElementById('formulaBarInput').addEventListener('focus', () => { cellEditSession = null; });
        document.getElementById('formulaBarInput').addEventListener('input', (e) => {
            const { rowIndex, colKey } = activeSelection;
            const colMeta = COLUMNS.find(c => c.key === colKey);
            if (!colMeta || !colMeta.editable) return;
            handleCellInput(rowIndex, colKey, e.target.value);
            const cellInput = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colKey}"]`);
            if (cellInput) cellInput.value = e.target.value;
        });

        function addRows(count = 1) {
            saveUndoSnapshot(`Before adding ${count} month row(s)`);
            for (let c = 0; c < count; c++) {
                const lastRow = rows[rows.length - 1];
                const nextMonth = lastRow
                    ? getNextMonthLabel(lastRow.month, monthConfig.intervalMonths, monthConfig.format)
                    : formatDateByPattern(new Date(new Date().getFullYear(), new Date().getMonth(), 1), monthConfig.format);
                rows.push({
                    month: nextMonth,
                    startingBal: lastRow ? lastRow.endingBal : 10000,
                    overrideStarting: false,
                    addingBal: lastRow ? lastRow.addingBal : 500,
                    returnPct: lastRow ? lastRow.returnPct : 4.50,
                    grossProfit: 0,
                    withdrawals: 0,
                    netProfit: 0,
                    endingBal: 0
                });
            }
            recalculateSpreadsheet();
            renderSpreadsheet();
            showToast(`Added ${count} month${count > 1 ? 's' : ''} (${monthConfig.format})`, true);
        }

        function fillMonthSeriesFromRow(startRowIndex = 0) {
            if (!rows[startRowIndex]) return;
            const parsed = parseFlexibleMonthString(rows[startRowIndex].month) || {
                year: 2026, monthIndex: 9, detectedFormat: monthConfig.format
            };
            saveUndoSnapshot(`Month series fill from Row ${startRowIndex + 1}`);
            if (parsed.detectedFormat) {
                monthConfig.format = parsed.detectedFormat;
                updateColAHeaderBadge();
            }
            for (let i = startRowIndex; i < rows.length; i++) {
                const offsetMonths = (i - startRowIndex) * monthConfig.intervalMonths;
                const d = new Date(parsed.year, parsed.monthIndex + offsetMonths, 1);
                rows[i].month = formatDateByPattern(d, monthConfig.format);
            }
            renderSpreadsheet();
            selectCell(startRowIndex, 'month', false);
            showToast(`Sequenced months from Row ${startRowIndex + 1} (${rows[startRowIndex].month} → ${rows[rows.length - 1].month})`, true);
        }

        function openClearModal() {
            const modal = document.getElementById('clearModal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeClearModal() {
            const modal = document.getElementById('clearModal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        function confirmClearAll(mode) {
            saveUndoSnapshot('Clear All Data');
            if (mode === 'blank_sheet') {
                const firstMonth = rows[0]?.month || formatDateByPattern(new Date(new Date().getFullYear(), new Date().getMonth(), 1), monthConfig.format);
                rows = [{
                    month: firstMonth, startingBal: 0, overrideStarting: false, addingBal: 0, returnPct: 0, grossProfit: 0, withdrawals: 0, netProfit: 0, endingBal: 0
                }];
                activeSelection = { rowIndex: 0, colKey: 'startingBal' };
                recalculateSpreadsheet();
                renderSpreadsheet();
                closeClearModal();
                showToast('Wiped to a fresh 1-row blank sheet', true);
            } else {
                rows.forEach((r) => {
                    r.startingBal = 0;
                    r.overrideStarting = false;
                    r.addingBal = 0;
                    r.returnPct = 0;
                    r.withdrawals = 0;
                });
                recalculateSpreadsheet();
                renderSpreadsheet();
                closeClearModal();
                showToast('Zeroed out all balances, returns, and withdrawals', true);
            }
        }

        function exportCSV() {
            const blob = new Blob([SheetCSV.createCSV(rows, formatCurrencyInput)], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'Vestly_USD_Investment_Schedule.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('Exported USD spreadsheet to CSV');
        }

        function runQuickPrompt(promptText) {
            const input = document.getElementById('aiPromptInput');
            input.value = promptText;
            executeAICommand(promptText);
        }

        function handleAICommandSubmit(event) {
            event.preventDefault();
            const input = document.getElementById('aiPromptInput');
            const query = input.value.trim();
            if (!query) return;
            executeAICommand(query);
        }

        function setAILoadingState(isLoading) {
            const badge = document.getElementById('aiStatusBadge');
            const submitBtn = document.getElementById('aiSubmitBtn');
            const icon = document.getElementById('aiSparkleIcon');
            if (isLoading) {
                badge.classList.remove('hidden');
                badge.classList.add('inline-flex');
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-60');
                icon.className = 'ph-bold ph-spinner animate-spin text-sm';
            } else {
                badge.classList.add('hidden');
                badge.classList.remove('inline-flex');
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-60');
                icon.className = 'ph-fill ph-sparkle text-sm';
            }
        }

        const geminiClient = GeminiSheet.createGeminiClient();
        let aiBusy = false;
        let aiConnecting = false;
        let connectedModel = '';
        function aiFeedback(message) {
            document.getElementById('aiFeedback').textContent = message;
        }
        function updateAIConnectionUI() {
            const connected = geminiClient.isConnected();
            document.getElementById('connectAIButton').textContent = connected ? 'AI connected · Settings' : 'Connect AI';
            document.getElementById('aiConnectionStatus').textContent = connected ? 'Connected to ' + connectedModel : 'Connect Gemini to edit your sheet with AI';
            document.getElementById('disconnectAIButton').hidden = !connected && !aiConnecting;
            document.getElementById('saveAIButton').disabled = aiConnecting;
            document.getElementById('saveAIButton').textContent = aiConnecting ? 'Connecting…' : 'Connect';
        }
        function openAIConnection() {
            document.getElementById('aiConnectFeedback').textContent = geminiClient.isConnected() ? 'Your key is connected for this tab. You can replace it or disconnect.' : '';
            updateAIConnectionUI();
            document.getElementById('aiConnectionDialog').showModal();
        }
        function closeAIConnection() {
            document.getElementById('geminiKeyInput').value = '';
            if (aiConnecting) disconnectAI();
            document.getElementById('aiConnectionDialog').close();
        }
        function disconnectAI() {
            geminiClient.disconnect();
            connectedModel = '';
            document.getElementById('geminiKeyInput').value = '';
            aiFeedback('AI disconnected. Your sheet is still saved in this browser.');
            document.getElementById('aiConnectFeedback').textContent = 'Disconnected. The key has been cleared.';
            updateAIConnectionUI();
        }
        document.getElementById('aiConnectionDialog').addEventListener('cancel', closeAIConnection);
        document.getElementById('aiConnectionForm').addEventListener('submit', async event => {
            event.preventDefault();
            if (aiConnecting || aiBusy) return;
            const field = document.getElementById('geminiKeyInput');
            const value = field.value;
            field.value = '';
            aiConnecting = true;
            document.getElementById('aiConnectFeedback').textContent = 'Checking your key with Google…';
            updateAIConnectionUI();
            try {
                connectedModel = await geminiClient.connect(value);
                document.getElementById('aiConnectionDialog').close();
                aiFeedback('AI connected. Type an instruction and press Run.');
            } catch (error) {
                document.getElementById('aiConnectFeedback').textContent = error.message;
            } finally {
                aiConnecting = false;
                updateAIConnectionUI();
            }
        });
        async function executeAICommand(userCommand) {
            if (aiBusy || aiConnecting) return;
            if (!geminiClient.isConnected()) {
                aiFeedback('Connect your Gemini key to run AI instructions.');
                openAIConnection();
                return;
            }
            if (!userCommand.trim()) return;
            aiBusy = true;
            setAILoadingState(true);
            aiFeedback('AI is updating your sheet…');
            const snapshot = JSON.stringify({ rows, monthConfig });
            try {
                const result = await geminiClient.update(userCommand, rows, monthConfig);
                if (snapshot !== JSON.stringify({ rows, monthConfig })) throw new Error('You edited the sheet while AI was working. Run the instruction again to use your latest changes.');
                saveUndoSnapshot('AI instruction');
                rows = result.rows;
                activeSelection.rowIndex = Math.min(activeSelection.rowIndex, rows.length - 1);
                recalculateSpreadsheet();
                renderSpreadsheet();
                selectCell(activeSelection.rowIndex, activeSelection.colKey, false);
                aiFeedback(result.summary + ' Use Undo to restore the previous sheet.');
                showToast('AI changes applied', true);
                document.getElementById('aiPromptInput').value = '';
            } catch (error) {
                aiFeedback(error.message || 'AI could not update the sheet. Your sheet is unchanged.');
            } finally {
                aiBusy = false;
                setAILoadingState(false);
            }
        }

        const STORAGE_KEY = 'vestsheet-usd-v1';
        let storageReady = false;
        function saveSchedule() {
            if (!storageReady) return;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, monthConfig }));
                document.getElementById('privacyStatus').textContent = 'Saved in this browser only';
            } catch {
                document.getElementById('privacyStatus').textContent = 'Saving unavailable — export CSV before closing';
            }
        }
        function loadSchedule() {
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
                const fields = ['startingBal', 'addingBal', 'returnPct', 'withdrawals'];
                if (!saved || !Array.isArray(saved.rows) || !saved.rows.length ||
                    !saved.rows.every(r => typeof r.month === 'string' && fields.every(k => Number.isFinite(r[k])))) return false;
                rows = saved.rows;
                if (saved.monthConfig && ['MMM YYYY', 'MMMM YYYY', 'MM/YYYY', 'YYYY-MM'].includes(saved.monthConfig.format) &&
                    [1, 3, 6, 12].includes(saved.monthConfig.intervalMonths)) monthConfig = saved.monthConfig;
                return true;
            } catch { return false; }
        }

        window.addEventListener('DOMContentLoaded', () => {
            storageReady = true;
            if (loadSchedule()) {
                updateColAHeaderBadge();
                recalculateSpreadsheet();
                renderSpreadsheet();
                selectCell(0, 'startingBal', false);
            } else loadSampleData();
        });
    
        // Delegated events also cover rows rendered after AI updates or Add Row.
        document.addEventListener('click', event => {
            const target = event.target.closest('[data-action]');
            if (!target) return;
            const data = target.dataset;
            const actions = {
                addRows: () => addRows(Number(data.number)),
                undoLastAction, openClearModal, closeClearModal, exportCSV,
                openAIConnection, closeAIConnection, disconnectAI,
                confirmClearAll: () => confirmClearAll(data.mode),
                fillMonthSeriesFromRow: () => fillMonthSeriesFromRow(Number(data.number)),
                runQuickPrompt: () => runQuickPrompt(data.prompt),
                selectCell: () => selectCell(Number(data.selectRow), data.selectCol, data.selectFocus === 'true')
            };
            actions[data.action]?.();
        });
        document.getElementById('aiCommandForm').addEventListener('submit', handleAICommandSubmit);
        document.getElementById('sheetBody').addEventListener('focusin', event => {
            const input = event.target.closest('input[data-row][data-col]');
            if (input) handleCellFocus(Number(input.dataset.row), input.dataset.col);
        });
        document.getElementById('sheetBody').addEventListener('input', event => {
            const input = event.target.closest('input[data-row][data-col]');
            if (input) handleCellInput(Number(input.dataset.row), input.dataset.col, input.value);
        });
        document.getElementById('sheetBody').addEventListener('keydown', event => {
            const input = event.target.closest('input[data-row][data-col]');
            if (input) handleCellKeydown(event, Number(input.dataset.row), input.dataset.col);
        });
