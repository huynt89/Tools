document.addEventListener('DOMContentLoaded', () => {
    const holidayList = document.getElementById('holiday-list');
    const leaveList = document.getElementById('leave-list');
    const makeupList = document.getElementById('makeup-list');
    const overtimeList = document.getElementById('overtime-list');
    const monthField = document.getElementById('salary-month');
    const errorBox = document.getElementById('salary-error');
    const actualDaysField = document.getElementById('actual-days');
    const standardDaysField = document.getElementById('standard-days');
    const mealDaysField = document.getElementById('meal-days');
    const baseSalaryField = document.getElementById('base-salary');
    const calculationInputs = [...document.querySelectorAll('.salary-page input[type="number"], .salary-page input.money-amount')];
    const moneyInputs = [...document.querySelectorAll('.salary-page input.money-amount')];
    let activeHolidayYear = '';

    function formatCurrency(amount) {
        return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
    }

    function formatNumber(amount) {
        return amount.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function toDateKey(date) {
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }

    function getVietnameseHolidays(year) {
        const lunarFormatter = new Intl.DateTimeFormat('en-u-ca-chinese', {
            month: 'numeric',
            day: 'numeric',
            timeZone: 'UTC'
        });
        if (lunarFormatter.resolvedOptions().calendar !== 'chinese' || typeof lunarFormatter.formatToParts !== 'function') {
            throw new Error('Trình duyệt không hỗ trợ tự tạo ngày lễ âm lịch. Bạn có thể thêm ngày lễ thủ công.');
        }

        let lunarNewYear = '';
        let hungKingsDay = '';
        const start = Date.UTC(year, 0, 1);
        const end = Date.UTC(year + 1, 0, 1);
        for (let timestamp = start; timestamp < end; timestamp += 24 * 60 * 60 * 1000) {
            const date = new Date(timestamp);
            const parts = lunarFormatter.formatToParts(date);
            const lunarMonth = Number.parseInt(parts.find((part) => part.type === 'month')?.value, 10);
            const lunarDay = Number.parseInt(parts.find((part) => part.type === 'day')?.value, 10);
            if (lunarMonth === 1 && lunarDay === 1 && !lunarNewYear) lunarNewYear = toDateKey(date);
            if (lunarMonth === 3 && lunarDay === 10 && !hungKingsDay) hungKingsDay = toDateKey(date);
        }
        if (!lunarNewYear) throw new Error(`Không tìm thấy ngày Tết âm lịch của năm ${year}.`);

        const lunarNewYearDate = new Date(`${lunarNewYear}T00:00:00Z`);
        const dates = [
            `${year}-01-01`,
            `${year}-04-30`,
            `${year}-05-01`,
            `${year}-09-01`,
            `${year}-09-02`,
            hungKingsDay
        ];
        for (let offset = -1; offset <= 3; offset += 1) {
            const holidayDate = new Date(lunarNewYearDate);
            holidayDate.setUTCDate(holidayDate.getUTCDate() + offset);
            dates.push(toDateKey(holidayDate));
        }

        return [...new Set(dates.filter(Boolean))].filter((date) => date.startsWith(`${year}-`)).sort();
    }

    function workdayValue(dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);
        const weekday = new Date(year, month - 1, day).getDay();
        if (weekday === 0) return 0;
        if (weekday === 6) return 0.5;
        return 1;
    }

    function datesInMonth(list, monthKey) {
        const dates = new Set();
        list.querySelectorAll('.calendar-date').forEach((input) => {
            if (input.value.startsWith(`${monthKey}-`)) dates.add(input.value);
        });
        return [...dates];
    }

    function updateAttendanceFromCalendar() {
        if (!monthField.value) {
            standardDaysField.value = '';
            actualDaysField.value = '';
            mealDaysField.value = '';
            return;
        }
        const [year, month] = monthField.value.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        let standardDays = 0;
        for (let day = 1; day <= daysInMonth; day += 1) {
            standardDays += workdayValue(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
        const holidays = datesInMonth(holidayList, monthField.value);
        standardDays -= holidays.reduce((total, date) => total + workdayValue(date), 0);
        const leaveDays = datesInMonth(leaveList, monthField.value)
            .filter((date) => !holidays.includes(date))
            .reduce((total, date) => total + workdayValue(date), 0);
        const makeupDays = datesInMonth(makeupList, monthField.value)
            .reduce((total, date) => {
                const value = workdayValue(date);
                return total + (value === 0 ? 1 : value);
            }, 0);
        standardDays = Math.max(0, standardDays);
        standardDaysField.value = String(standardDays);
        actualDaysField.value = String(Math.max(0, standardDays - leaveDays + makeupDays));
        mealDaysField.value = String(standardDays);
    }

    function formatMoneyInput(field) {
        const cursor = field.selectionStart;
        const digitsBeforeCursor = field.value.slice(0, cursor).replace(/\D/g, '').length;
        const digits = field.value.replace(/\D/g, '');
        field.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        if (cursor !== null) {
            let nextCursor = 0;
            let digitsSeen = 0;
            while (nextCursor < field.value.length && digitsSeen < digitsBeforeCursor) {
                if (/\d/.test(field.value[nextCursor])) digitsSeen += 1;
                nextCursor += 1;
            }
            field.setSelectionRange(nextCursor, nextCursor);
        }
    }

    function makeCalendarRow(dateLabel, onChange) {
        const row = document.createElement('div');
        row.className = 'calendar-record';
        row.innerHTML = `
            <label>
                <span>${dateLabel}</span>
                <input class="input calendar-date" type="date" aria-label="${dateLabel}">
            </label>
            <button class="remove-record" type="button" aria-label="Xóa ${dateLabel.toLocaleLowerCase('vi')}" title="Xóa">×</button>
        `;
        row.querySelector('.calendar-date').addEventListener('input', onChange);
        row.querySelector('.calendar-date').addEventListener('change', onChange);
        row.querySelector('.remove-record').addEventListener('click', () => {
            row.remove();
            onChange();
        });
        return row;
    }

    function makeOvertimeRow() {
        const row = document.createElement('div');
        row.className = 'overtime-record';
        row.innerHTML = `
            <label class="ot-date-field"><span>Ngày OT</span><input class="input ot-date" type="date" aria-label="Ngày làm thêm"></label>
            <label class="ot-start-field"><span>Vào</span><input class="input ot-start" type="time" aria-label="Giờ bắt đầu làm thêm"></label>
            <label class="ot-end-field"><span>Ra</span><input class="input ot-end" type="time" aria-label="Giờ kết thúc làm thêm"></label>
            <output class="ot-hours">—</output>
            <output class="ot-coefficient">—</output>
            <button class="remove-record" type="button" aria-label="Xóa ngày làm thêm" title="Xóa ngày làm thêm">×</button>
        `;
        row.querySelector('.remove-record').addEventListener('click', () => {
            row.remove();
            calculate();
        });
        row.querySelectorAll('input').forEach((input) => {
            input.addEventListener('input', () => calculate());
            input.addEventListener('change', () => calculate());
        });
        return row;
    }

    function readNumber(field, label, options = {}) {
        const text = field.value.trim();
        if (!text) throw new Error(`Vui lòng nhập ${label}.`);
        const normalizedText = field.classList.contains('money-amount') ? text.replace(/\./g, '') : text;
        const value = Number(normalizedText);
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
            const hasEntry = Boolean(date || start || end);
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
            const overtimeHours = (endMinutes - startMinutes) / 60;
            const dateParts = date.split('-').map(Number);
            const weekday = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay();
            const rate = weekday === 0 || weekday === 6 ? 2 : 1.5;
            const coefficient = overtimeHours * rate / 8;
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

    function calculate() {
        if (!monthField.value) {
            clearResults();
            errorBox.textContent = '';
            errorBox.classList.remove('visible');
            return false;
        }
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
            const relocationAllowance = relocation * workingDays / standardDays;
            const hazardAllowance = hazardRate * actualDays;
            const mealAllowance = mealRate * mealDays;
            const socialInsurance = baseSalary * 0.095;
            const unemploymentInsurance = baseSalary * 0.01;
            const unionFee = baseSalary * 0.01;
            const totalDeductions = socialInsurance + unemploymentInsurance + unionFee;
            const otherDeductions = phoneFee + donation;
            const netSalary = earnedSalary + relocationAllowance + hqcv + hazardAllowance + mealAllowance
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
            setOutput('salary-relocation', relocationAllowance);
            setOutput('salary-hazard', hazardAllowance);
            setOutput('salary-meal', mealAllowance);
            setOutput('salary-deductions', totalDeductions, true);
            setOutput('salary-other-deductions', otherDeductions, true);
            setOutput('salary-refund', taxRefund);
            errorBox.textContent = '';
            errorBox.classList.remove('visible');
            return true;
        } catch (error) {
            clearResults();
            errorBox.textContent = error.message;
            errorBox.classList.add('visible');
            return false;
        }
    }

    const refreshAttendance = () => {
        updateAttendanceFromCalendar();
        calculate();
    };
    document.getElementById('add-holiday').addEventListener('click', () => {
        holidayList.appendChild(makeCalendarRow('Ngày nghỉ lễ', refreshAttendance));
    });
    document.getElementById('add-leave').addEventListener('click', () => {
        leaveList.appendChild(makeCalendarRow('Ngày nghỉ phép', refreshAttendance));
    });
    document.getElementById('add-makeup').addEventListener('click', () => {
        makeupList.appendChild(makeCalendarRow('Ngày làm bù', refreshAttendance));
    });
    document.getElementById('add-overtime').addEventListener('click', () => {
        overtimeList.appendChild(makeOvertimeRow());
    });
    monthField.addEventListener('input', () => handleMonthChange());
    monthField.addEventListener('change', () => handleMonthChange());
    moneyInputs.forEach((input) => {
        formatMoneyInput(input);
        input.addEventListener('input', () => formatMoneyInput(input));
        input.addEventListener('blur', () => {
            if (!input.value) {
                input.value = '0';
                calculate();
            }
        });
    });
    calculationInputs.forEach((input) => {
        input.addEventListener('input', () => calculate());
        input.addEventListener('change', () => calculate());
    });

    overtimeList.appendChild(makeOvertimeRow());
    function handleMonthChange() {
        const monthKey = monthField.value;
        if (!monthKey) {
            updateAttendanceFromCalendar();
            clearResults();
            errorBox.textContent = '';
            errorBox.classList.remove('visible');
            return;
        }
        const year = monthKey.slice(0, 4);
        if (year !== activeHolidayYear) {
            try {
                holidayList.replaceChildren(...getVietnameseHolidays(Number(year)).map((date) => {
                    const row = makeCalendarRow('Ngày nghỉ lễ', refreshAttendance);
                    row.querySelector('.calendar-date').value = date;
                    return row;
                }));
                activeHolidayYear = year;
            } catch (error) {
                errorBox.textContent = error.message;
                errorBox.classList.add('visible');
                clearResults();
                return;
            }
        }
        const month = Number(monthKey.slice(5, 7));
        const monthlyVariation = month % 3 === 1 ? 0 : (month % 3 === 2 ? -500000 : 500000);
        const hqcvField = document.getElementById('hqcv');
        hqcvField.value = String(5500000 + monthlyVariation).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        updateAttendanceFromCalendar();
        calculate();
    }
    clearResults();
});
