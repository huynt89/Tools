document.addEventListener('DOMContentLoaded', () => {
    const holidayList = document.getElementById('holiday-list');
    const makeupList = document.getElementById('makeup-list');
    const overtimeList = document.getElementById('overtime-list');
    const errorBox = document.getElementById('salary-error');
    const actualDaysField = document.getElementById('actual-days');
    const standardDaysField = document.getElementById('standard-days');
    const mealDaysField = document.getElementById('meal-days');
    const baseSalaryField = document.getElementById('base-salary');
    const numericInputs = [...document.querySelectorAll('.salary-page input[type="number"]')];

    function formatCurrency(amount) {
        return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
    }

    function formatNumber(amount) {
        return amount.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function makeCalendarRow(dateLabel, notePlaceholder) {
        const row = document.createElement('div');
        row.className = 'calendar-record';
        row.innerHTML = `
            <label>
                <span>${dateLabel}</span>
                <input class="input calendar-date" type="date" aria-label="${dateLabel}">
            </label>
            <label>
                <span>Ghi chú</span>
                <input class="input calendar-name" type="text" maxlength="60" placeholder="${notePlaceholder}" aria-label="Ghi chú ${dateLabel.toLocaleLowerCase('vi')}">
            </label>
            <button class="remove-record" type="button" aria-label="Xóa ${dateLabel.toLocaleLowerCase('vi')}" title="Xóa">×</button>
        `;
        row.querySelector('.remove-record').addEventListener('click', () => row.remove());
        return row;
    }

    function makeOvertimeRow() {
        const row = document.createElement('div');
        row.className = 'overtime-record';
        row.innerHTML = `
            <label class="ot-date-field"><span>Ngày OT</span><input class="input ot-date" type="date" aria-label="Ngày làm thêm"></label>
            <label class="ot-start-field"><span>Vào</span><input class="input ot-start" type="time" aria-label="Giờ bắt đầu làm thêm"></label>
            <label class="ot-end-field"><span>Ra</span><input class="input ot-end" type="time" aria-label="Giờ kết thúc làm thêm"></label>
            <label class="ot-break-field"><span>Ăn trưa (giờ)</span><input class="input ot-break" type="number" min="0" max="24" step="0.5" inputmode="decimal" aria-label="Thời gian nghỉ ăn trưa"></label>
            <output class="ot-hours">—</output>
            <output class="ot-coefficient">—</output>
            <button class="remove-record" type="button" aria-label="Xóa ngày làm thêm" title="Xóa ngày làm thêm">×</button>
        `;
        row.querySelector('.remove-record').addEventListener('click', () => {
            row.remove();
            calculate(false);
        });
        row.querySelectorAll('input').forEach((input) => {
            input.addEventListener('input', () => calculate(false));
            input.addEventListener('change', () => calculate(false));
        });
        return row;
    }

    function readNumber(field, label, options = {}) {
        const text = field.value.trim();
        if (!text) throw new Error(`Vui lòng nhập ${label}.`);
        const value = Number(text);
        if (!Number.isFinite(value) || value < (options.min ?? 0) || (options.max !== undefined && value > options.max)) {
            const range = options.max === undefined
                ? `không nhỏ hơn ${options.min ?? 0}`
                : `nằm trong khoảng ${options.min ?? 0} đến ${options.max}`;
            throw new Error(`${label} phải là số hợp lệ và ${range}.`);
        }
        return value;
    }

    function readOvertimeRows() {
        let totalEquivalentDays = 0;
        let totalOvertimeHours = 0;
        overtimeList.querySelectorAll('.overtime-record').forEach((row, index) => {
            const date = row.querySelector('.ot-date').value;
            const start = row.querySelector('.ot-start').value;
            const end = row.querySelector('.ot-end').value;
            const breakValue = row.querySelector('.ot-break').value.trim();
            const hasEntry = Boolean(date || start || end || (breakValue && Number(breakValue) !== 0));
            if (!hasEntry) {
                row.querySelector('.ot-hours').textContent = '—';
                row.querySelector('.ot-coefficient').textContent = '—';
                return;
            }
            if (!date || !start || !end) {
                throw new Error(`Dòng OT ${index + 1}: vui lòng nhập đủ ngày, giờ vào và giờ ra.`);
            }
            const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
            let endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
            if (endMinutes === startMinutes) {
                throw new Error(`Dòng OT ${index + 1}: giờ vào và giờ ra không được trùng nhau.`);
            }
            if (endMinutes < startMinutes) endMinutes += 24 * 60;
            const breakHours = breakValue ? Number(breakValue) : 0;
            if (!Number.isFinite(breakHours) || breakHours < 0 || breakHours * 60 > endMinutes - startMinutes) {
                throw new Error(`Dòng OT ${index + 1}: thời gian ăn trưa không hợp lệ.`);
            }
            const overtimeHours = (endMinutes - startMinutes) / 60 - breakHours;
            const coefficient = overtimeHours * 1.5 / 6;
            row.querySelector('.ot-hours').textContent = `${formatNumber(overtimeHours)} giờ`;
            row.querySelector('.ot-coefficient').textContent = formatNumber(coefficient);
            totalOvertimeHours += overtimeHours;
            totalEquivalentDays += coefficient;
        });
        return { totalEquivalentDays, totalOvertimeHours };
    }

    function setOutput(id, amount, deduction = false) {
        document.getElementById(id).textContent = `${deduction ? '− ' : ''}${formatCurrency(amount)}`;
    }

    function clearResults() {
        [
            'salary-total',
            'working-days',
            'overtime-hours-total',
            'overtime-equivalent-total',
            'social-insurance',
            'unemployment-insurance',
            'union-fee',
            'salary-earned',
            'salary-hqcv',
            'salary-relocation',
            'salary-hazard',
            'salary-meal',
            'salary-deductions',
            'salary-other-deductions',
            'salary-refund'
        ].forEach((id) => {
            document.getElementById(id).textContent = '—';
        });
    }

    function calculate(showError = true) {
        try {
            const standardDays = readNumber(standardDaysField, 'ngày công chuẩn', { min: 0.01, max: 31 });
            const actualDays = readNumber(actualDaysField, 'công thực tế', { max: 31 });
            const mealDays = readNumber(mealDaysField, 'công ăn trưa', { max: 31 });
            const baseSalary = readNumber(baseSalaryField, 'mức lương LCB');
            const hqcv = readNumber(document.getElementById('hqcv'), 'phụ cấp HQCV');
            const relocation = readNumber(document.getElementById('relocation'), 'trợ cấp chuyển vùng');
            const hazardRate = readNumber(document.getElementById('hazard-rate'), 'trợ cấp độc hại mỗi ngày');
            const mealRate = readNumber(document.getElementById('meal-rate'), 'trợ cấp ăn ca mỗi ngày');
            const phoneFee = readNumber(document.getElementById('phone-fee'), 'phí điện thoại');
            const donation = readNumber(document.getElementById('donation'), 'khoản ủng hộ');
            const taxRefund = readNumber(document.getElementById('tax-refund'), 'hoàn thuế');
            const overtime = readOvertimeRows();
            const overtimeEquivalent = overtime.totalEquivalentDays;
            const workingDays = actualDays + overtimeEquivalent;
            const earnedSalary = baseSalary * workingDays / standardDays;
            const hazardAllowance = hazardRate * actualDays;
            const mealAllowance = mealRate * mealDays;
            const socialInsurance = baseSalary * 0.095;
            const unemploymentInsurance = baseSalary * 0.01;
            const unionFee = baseSalary * 0.01;
            const totalDeductions = socialInsurance + unemploymentInsurance + unionFee;
            const otherDeductions = phoneFee + donation;
            const netSalary = earnedSalary + hqcv + relocation + hazardAllowance + mealAllowance
                - totalDeductions - otherDeductions + taxRefund;

            document.getElementById('working-days').textContent = formatNumber(workingDays);
            document.getElementById('overtime-hours-total').textContent = `${formatNumber(overtime.totalOvertimeHours)} giờ`;
            document.getElementById('overtime-equivalent-total').textContent = `${formatNumber(overtimeEquivalent)} công`;
            setOutput('social-insurance', socialInsurance, true);
            setOutput('unemployment-insurance', unemploymentInsurance, true);
            setOutput('union-fee', unionFee, true);
            document.getElementById('salary-total').textContent = formatCurrency(netSalary);
            setOutput('salary-earned', earnedSalary);
            setOutput('salary-hqcv', hqcv);
            setOutput('salary-relocation', relocation);
            setOutput('salary-hazard', hazardAllowance);
            setOutput('salary-meal', mealAllowance);
            setOutput('salary-deductions', totalDeductions, true);
            setOutput('salary-other-deductions', otherDeductions, true);
            setOutput('salary-refund', taxRefund);
            errorBox.classList.remove('visible');
            return true;
        } catch (error) {
            clearResults();
            if (showError) {
                errorBox.textContent = error.message;
                errorBox.classList.add('visible');
            }
            return false;
        }
    }

    document.getElementById('add-holiday').addEventListener('click', () => {
        holidayList.appendChild(makeCalendarRow('Ngày nghỉ/lễ', 'Tên ngày nghỉ'));
    });
    document.getElementById('add-makeup').addEventListener('click', () => {
        makeupList.appendChild(makeCalendarRow('Ngày làm bù', 'Ghi chú ngày làm bù'));
    });
    document.getElementById('add-overtime').addEventListener('click', () => {
        overtimeList.appendChild(makeOvertimeRow());
    });
    document.getElementById('calculate-salary').addEventListener('click', () => calculate(true));
    numericInputs.forEach((input) => {
        input.addEventListener('input', () => calculate(false));
        input.addEventListener('change', () => calculate(false));
    });

    holidayList.appendChild(makeCalendarRow('Ngày nghỉ/lễ', 'Tên ngày nghỉ'));
    makeupList.appendChild(makeCalendarRow('Ngày làm bù', 'Ghi chú ngày làm bù'));
    overtimeList.appendChild(makeOvertimeRow());
    clearResults();
});
