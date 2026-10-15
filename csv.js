(function (root) {
    function createCSV(rows, money = value => Number(value).toFixed(2)) {
        const headers = ['Row #', 'Month', 'Starting Bal ($)', 'Adding Bal ($)', 'Percentage Return (%)', 'Gross Profit ($)', 'Withdrawals ($)', 'Net Profit ($)', 'Ending Bal ($)'];
        const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
        const safeText = value => /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
        return '\uFEFF' + [headers.join(','), ...rows.map((r, i) => [i + 1, quote(safeText(r.month)), money(r.startingBal), money(r.addingBal), r.returnPct.toFixed(2) + '%', money(r.grossProfit), money(r.withdrawals), money(r.netProfit), money(r.endingBal)].join(','))].join('\r\n');
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { createCSV };
    else root.SheetCSV = { createCSV };
})(typeof window === 'undefined' ? {} : window);
