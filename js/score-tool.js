document.addEventListener('DOMContentLoaded', () => {
    const subjectList = document.getElementById('subject-list');
    const periodSelect = document.getElementById('period-select');
    const errorBox = document.getElementById('score-error');
    const results = document.getElementById('score-results');
    const maxSubjects = 20;

    function makeSubjectRow(index) {
        const row = document.createElement('div');
        row.className = 'subject-row';
        row.innerHTML = `
            <div class="subject-row-head">
                <span class="subject-index">${index + 1}</span>
                <div class="subject-name-wrap">
                    <label class="field-label">Tên môn học</label>
                    <input class="input subject-name" type="text" maxlength="60" placeholder="Ví dụ: Toán" aria-label="Tên môn học ${index + 1}">
                </div>
                <button class="remove-subject" type="button" aria-label="Xóa môn học ${index + 1}" title="Xóa môn học">×</button>
            </div>
            <div class="subject-fields score-fields">
                <div class="form-field">
                    <label class="field-label">Điểm thường xuyên</label>
                    <input class="input regular-scores" type="text" inputmode="decimal" placeholder="7, 8.5" aria-label="Điểm thường xuyên môn ${index + 1}">
                    <span class="field-hint">Ngăn cách bằng dấu phẩy; dùng dấu chấm cho phần thập phân.</span>
                </div>
                <div class="form-field annual-field">
                    <label class="field-label">ĐTB học kỳ I</label>
                    <input class="input first-semester-score" type="number" min="0" max="10" step="0.1" inputmode="decimal" placeholder="0 - 10" aria-label="Điểm trung bình học kỳ I môn ${index + 1}">
                </div>
                <div class="form-field">
                    <label class="field-label">Giữa kỳ</label>
                    <input class="input midterm-score" type="number" min="0" max="10" step="0.1" inputmode="decimal" placeholder="0 - 10" aria-label="Điểm giữa kỳ môn ${index + 1}">
                </div>
                <div class="form-field">
                    <label class="field-label">Cuối kỳ</label>
                    <input class="input final-score" type="number" min="0" max="10" step="0.1" inputmode="decimal" placeholder="0 - 10" aria-label="Điểm cuối kỳ môn ${index + 1}">
                </div>
            </div>
            <div class="subject-fields comment-fields">
                <div class="form-field">
                    <label class="field-label">Kết quả nhận xét</label>
                    <select class="select comment-result" aria-label="Kết quả đánh giá nhận xét môn ${index + 1}">
                        <option value="achieved">Đạt</option>
                        <option value="not-achieved">Chưa đạt</option>
                    </select>
                </div>
            </div>
            <div class="form-field subject-type-wrap">
                <label class="field-label">Hình thức đánh giá</label>
                <select class="select subject-type" aria-label="Hình thức đánh giá môn ${index + 1}">
                    <option value="score">Đánh giá bằng điểm số</option>
                    <option value="comment">Đánh giá bằng nhận xét</option>
                </select>
            </div>
        `;
        row.querySelector('.remove-subject').addEventListener('click', () => {
            row.remove();
            renumberRows();
        });
        row.querySelector('.subject-type').addEventListener('change', (event) => {
            row.classList.toggle('is-comment', event.target.value === 'comment');
        });
        return row;
    }

    function renumberRows() {
        subjectList.querySelectorAll('.subject-row').forEach((row, index) => {
            row.querySelector('.subject-index').textContent = String(index + 1);
            row.querySelector('.subject-name').setAttribute('aria-label', `Tên môn học ${index + 1}`);
            row.querySelector('.remove-subject').setAttribute('aria-label', `Xóa môn học ${index + 1}`);
        });
    }

    function roundOne(value) {
        return Math.round((value + Number.EPSILON) * 10) / 10;
    }

    function parseScore(value, fieldName, subjectName, required) {
        const trimmed = value.trim();
        if (!trimmed && !required) return null;
        if (!trimmed) throw new Error(`Vui lòng nhập ${fieldName} cho môn ${subjectName}.`);
        const score = Number(trimmed);
        if (!Number.isFinite(score) || score < 0 || score > 10) {
            throw new Error(`${fieldName} môn ${subjectName} phải nằm trong khoảng 0 đến 10.`);
        }
        return score;
    }

    function calculateSemesterAverage(row, subjectName) {
        const regularText = row.querySelector('.regular-scores').value.trim();
        const regularScores = regularText
            ? regularText.split(',').map((item) => item.trim())
            : [];
        if (regularScores.some((score) => score === '')) {
            throw new Error(`Điểm thường xuyên môn ${subjectName} chưa đúng định dạng. Hãy ngăn cách các điểm bằng dấu phẩy.`);
        }
        const parsedRegular = regularScores.map((score) => {
            const value = Number(score);
            if (!Number.isFinite(value) || value < 0 || value > 10) {
                throw new Error(`Điểm thường xuyên môn ${subjectName} phải nằm trong khoảng 0 đến 10.`);
            }
            return value;
        });
        const midterm = parseScore(row.querySelector('.midterm-score').value, 'điểm giữa kỳ', subjectName, true);
        const final = parseScore(row.querySelector('.final-score').value, 'điểm cuối kỳ', subjectName, true);
        const total = parsedRegular.reduce((sum, score) => sum + score, 0) + (2 * midterm) + (3 * final);
        return roundOne(total / (parsedRegular.length + 5));
    }

    function getClassification(subjects) {
        const scoredSubjects = subjects.filter((subject) => subject.average !== null);
        const commentSubjects = subjects.filter((subject) => subject.commentResult !== null);
        const allCommentsAchieved = commentSubjects.every((subject) => subject.commentResult === 'achieved');
        const notAchievedComments = commentSubjects.filter((subject) => subject.commentResult === 'not-achieved').length;
        const allAtLeast = (minimum) => scoredSubjects.length > 0 && scoredSubjects.every((subject) => subject.average >= minimum);
        const countAtLeast = (minimum) => scoredSubjects.filter((subject) => subject.average >= minimum).length;
        const hasCoreSubjectAtLeastEight = scoredSubjects.some((subject) => {
            const normalizedName = subject.name
                .toLocaleLowerCase('vi')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd');
            const isCoreSubject = normalizedName.includes('toan')
                || normalizedName.includes('ngu van')
                || normalizedName.includes('ngoai ngu')
                || normalizedName.includes('tieng anh')
                || normalizedName.includes('foreign language');
            return isCoreSubject && subject.average >= 8;
        });

        if (allCommentsAchieved && allAtLeast(6.5) && countAtLeast(8) >= 6 && hasCoreSubjectAtLeastEight) return 'Tốt';
        if (allCommentsAchieved && allAtLeast(5) && countAtLeast(6.5) >= 6) return 'Khá';
        if (notAchievedComments <= 1 && countAtLeast(5) >= 6 && scoredSubjects.every((subject) => subject.average >= 3.5)) return 'Đạt';
        return 'Chưa đạt';
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.classList.add('visible');
        results.classList.remove('visible');
    }

    function calculate() {
        errorBox.classList.remove('visible');
        const isAnnual = periodSelect.value === 'annual';
        const rows = [...subjectList.querySelectorAll('.subject-row')];
        if (rows.length === 0) {
            showError('Thêm ít nhất một môn học trước khi tính.');
            return;
        }
        try {
            const subjects = rows.map((row, index) => {
                const subjectName = row.querySelector('.subject-name').value.trim();
                if (!subjectName) throw new Error(`Vui lòng nhập tên môn học ở dòng ${index + 1}.`);
                if (row.querySelector('.subject-type').value === 'comment') {
                    return {
                        name: subjectName,
                        average: null,
                        annualAverage: null,
                        commentResult: row.querySelector('.comment-result').value
                    };
                }
                const average = calculateSemesterAverage(row, subjectName);
                const firstSemesterInput = row.querySelector('.first-semester-score').value;
                let annualAverage = null;
                if (isAnnual) {
                    const firstSemester = parseScore(firstSemesterInput, 'ĐTB học kỳ I', subjectName, true);
                    annualAverage = roundOne((firstSemester + (2 * average)) / 3);
                }
                return { name: subjectName, average, annualAverage, commentResult: null };
            });

            const assessedSubjects = subjects.map((subject) => ({
                ...subject,
                average: isAnnual ? subject.annualAverage : subject.average
            }));
            const scoredCount = assessedSubjects.filter((subject) => subject.average !== null).length;
            const classification = scoredCount < 6 ? 'Chưa đủ dữ liệu' : getClassification(assessedSubjects);
            const tableBody = document.getElementById('score-result-rows');
            tableBody.replaceChildren();

            subjects.forEach((subject) => {
                const tr = document.createElement('tr');
                const cells = [
                    subject.name,
                    subject.average === null ? '—' : subject.average.toFixed(1),
                    isAnnual ? (subject.annualAverage === null ? '—' : subject.annualAverage.toFixed(1)) : '—',
                    subject.commentResult === null ? 'Tính theo điểm' : (subject.commentResult === 'achieved' ? 'Đạt' : 'Chưa đạt')
                ];
                cells.forEach((value) => {
                    const td = document.createElement('td');
                    td.textContent = value;
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            });

            document.getElementById('score-classification').textContent = classification;
            document.getElementById('score-subject-count').textContent = `${scoredCount} môn`;
            document.getElementById('score-result-caption').textContent = isAnnual
                ? 'Điểm trung bình cả năm và xếp loại tham khảo.'
                : 'Điểm trung bình học kỳ và xếp loại tham khảo.';
            document.getElementById('score-result-note').textContent = scoredCount < 6
                ? `Hiện có ${scoredCount} môn tính điểm. Cần ít nhất 6 môn đánh giá bằng điểm số để tham khảo xếp loại theo các tiêu chí của Thông tư 22.`
                : 'Xếp loại được đối chiếu theo các tiêu chí kết quả học tập; nhà trường là đơn vị xác nhận kết quả chính thức.';
            results.classList.add('visible');
            results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (error) {
            showError(error.message);
        }
    }

    function updatePeriod() {
        subjectList.classList.toggle('is-annual', periodSelect.value === 'annual');
        results.classList.remove('visible');
        errorBox.classList.remove('visible');
    }

    for (let index = 0; index < 6; index += 1) subjectList.appendChild(makeSubjectRow(index));
    document.getElementById('add-subject').addEventListener('click', () => {
        const rowCount = subjectList.querySelectorAll('.subject-row').length;
        if (rowCount >= maxSubjects) {
            showError(`Bạn có thể nhập tối đa ${maxSubjects} môn học.`);
            return;
        }
        subjectList.appendChild(makeSubjectRow(rowCount));
    });
    document.getElementById('calculate-scores').addEventListener('click', calculate);
    periodSelect.addEventListener('change', updatePeriod);
});
