document.addEventListener('DOMContentLoaded', () => {
    const errorBox = document.getElementById('salary-error');
    const results = document.getElementById('salary-results');
    const fields = {
        base: document.getElementById('base-salary'),
        allowance: document.getElementById('allowance'),
        standardDays: document.getElementById('workdays'),
        workedDays: document.getElementById('worked-days'),
        hoursPerDay: document.getElementById('hours-per-day'),
        weekdayHours: document.getElementById('ot-weekday'),
        restdayHours: document.getElementById('ot-restday'),
        holidayHours: document.getElementById('ot-holiday'),
        weekdayRate: document.getElementById('rate-weekday'),
        restdayRate: document.getElementById('rate-restday'),
        holidayRate: document.getElementById('rate-holiday')
    };

    function readNumber(field, label, options = {}) {
        const text = field.value.trim();
        if (!text) throw new Error(`Vui lòng nhập ${label}.`);
        const value = Number(text);
        if (!Number.isFinite(value) || value < (options.min ?? 0) || (options.max !== undefined && value > options.max)) {
            const range = options.max === undefined ? `không nhỏ hơn ${options.min ?? 0}` : `nằm trong khoảng ${options.min ?? 0} đến ${options.max}`;
            throw new Error(`${label} phải là số hợp lệ và ${range}.`);
        }
        return value;
    }

    function formatCurrency(amount) {
        return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.classList.add('visible');
        results.classList.remove('visible');
    }

    function calculate() {
        errorBox.classList.remove('visible');
        try {
            const base = readNumber(fields.base, 'lương tháng làm căn cứ');
            const allowance = readNumber(fields.allowance, 'phụ cấp tháng');
            const standardDays = readNumber(fields.standardDays, 'ngày công chuẩn', { min: 0.01, max: 31 });
            const workedDays = readNumber(fields.workedDays, 'ngày công thực tế', { max: 31 });
            const hoursPerDay = readNumber(fields.hoursPerDay, 'giờ làm việc tiêu chuẩn mỗi ngày', { min: 0.01, max: 24 });
            const weekdayHours = readNumber(fields.weekdayHours, 'số giờ OT ngày thường');
            const restdayHours = readNumber(fields.restdayHours, 'số giờ OT ngày nghỉ');
            const holidayHours = readNumber(fields.holidayHours, 'số giờ OT ngày lễ');
            const weekdayRate = readNumber(fields.weekdayRate, 'hệ số OT ngày thường');
            const restdayRate = readNumber(fields.restdayRate, 'hệ số OT ngày nghỉ');
            const holidayRate = readNumber(fields.holidayRate, 'hệ số OT ngày lễ');

            const attendanceRatio = workedDays / standardDays;
            const proratedSalary = base * attendanceRatio;
            const proratedAllowance = allowance * attendanceRatio;
            const hourlyRate = base / standardDays / hoursPerDay;
            const weekdayOvertime = hourlyRate * weekdayHours * weekdayRate;
            const restdayOvertime = hourlyRate * restdayHours * restdayRate;
            const holidayOvertime = hourlyRate * holidayHours * holidayRate;
            const total = proratedSalary + proratedAllowance + weekdayOvertime + restdayOvertime + holidayOvertime;

            document.getElementById('salary-total').textContent = formatCurrency(total);
            document.getElementById('salary-total-copy').textContent = formatCurrency(total);
            document.getElementById('salary-prorated').textContent = formatCurrency(proratedSalary);
            document.getElementById('salary-allowance').textContent = formatCurrency(proratedAllowance);
            document.getElementById('salary-weekday-ot').textContent = formatCurrency(weekdayOvertime);
            document.getElementById('salary-restday-ot').textContent = formatCurrency(restdayOvertime);
            document.getElementById('salary-holiday-ot').textContent = formatCurrency(holidayOvertime);
            document.getElementById('salary-hourly').textContent = `${formatCurrency(hourlyRate)} / giờ`;
            results.classList.add('visible');
            results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (error) {
            showError(error.message);
        }
    }

    document.getElementById('calculate-salary').addEventListener('click', calculate);
});
