const { con } = require('../../config/connectDatabase');

const getDayOfWeekVN = (dayIndex) => {
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[dayIndex];
};

const formatDateYYYYMMDD = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getLocalToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const parseLocalDate = (dateStr) => {
    if (!dateStr) return getLocalToday();

    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');

        if (parts.length === 2) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        }

        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
    }

    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');

        if (parts.length === 3) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
    }

    return getLocalToday();
};

const xemLichTruc = {
    getLichTruc: async (req, res) => {
        try {
            const bacSiId = req.session.user.id;

            let baseDate = parseLocalDate(req.query.date);

            const year = baseDate.getFullYear();
            const month = baseDate.getMonth();

            const firstDayOfMonth = new Date(year, month, 1);
            const lastDayOfMonth = new Date(year, month + 1, 0);
            const totalDays = lastDayOfMonth.getDate();

            let startDayOfWeek = firstDayOfMonth.getDay();
            let emptyDaysBefore = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

            const monthDays = [];

            for (let i = 0; i < emptyDaysBefore; i++) {
                monthDays.push({ isEmpty: true });
            }

            for (let i = 1; i <= totalDays; i++) {
                const currentDate = new Date(year, month, i);

                monthDays.push({
                    isEmpty: false,
                    dateString: formatDateYYYYMMDD(currentDate),
                    dayName: getDayOfWeekVN(currentDate.getDay()),
                    displayDayOnly: i,
                    hasLich: false,
                    soPhong: null
                });
            }

            const totalCells = monthDays.length;
            const remainingCells = (7 - (totalCells % 7)) % 7;

            for (let i = 0; i < remainingCells; i++) {
                monthDays.push({ isEmpty: true });
            }

            const startDateStr = formatDateYYYYMMDD(firstDayOfMonth);
            const endDateStr = formatDateYYYYMMDD(lastDayOfMonth);

            const sql = `
                SELECT 
                    DATE_FORMAT(ck.ngay, '%Y-%m-%d') AS ngayStr, 
                    GROUP_CONCAT(DISTINCT p.soPhong SEPARATOR ', ') AS cacPhong
                FROM CaKham ck
                JOIN BacSi bs ON ck.id_bacSi = bs.id
                LEFT JOIN Phong p ON p.id_chuyenKhoa = bs.id_chuyenKhoa
                WHERE ck.id_bacSi = ? 
                  AND ck.ngay BETWEEN ? AND ?
                GROUP BY ck.ngay
            `;

            const [rows] = await con.promise().query(sql, [
                bacSiId,
                startDateStr,
                endDateStr
            ]);

            rows.forEach(row => {
                const dayMatch = monthDays.find(d => !d.isEmpty && d.dateString === row.ngayStr);

                if (dayMatch) {
                    dayMatch.hasLich = true;
                    dayMatch.soPhong = row.cacPhong || 'Chưa phân phòng';
                }
            });

            const prevMonthDate = new Date(year, month - 1, 1);
            const nextMonthDate = new Date(year, month + 1, 1);
            const currentMonthInput = `${year}-${String(month + 1).padStart(2, '0')}`;

            res.render('bacSi/xemLich', {
                user: req.session.user,
                page: 'lichKham',
                monthDays,
                prevMonthStr: formatDateYYYYMMDD(prevMonthDate),
                nextMonthStr: formatDateYYYYMMDD(nextMonthDate),
                currentMonthDisplay: `Tháng ${month + 1}/${year}`,
                currentMonthInput
            });

        } catch (error) {
            console.error("Lỗi xem lịch khám:", error);
            res.status(500).send("Đã xảy ra lỗi khi tải lịch khám.");
        }
    },

    layThongTinDoiLich: async (req, res) => {
        try {
            const bacSiId = req.session.user.id;
            const tenBacSi = req.session.user.hoTen;

            const today = formatDateYYYYMMDD(getLocalToday());

            const sqlLich = `
                SELECT 
                    DATE_FORMAT(ngay, '%Y-%m-%d') AS ngayStr, 
                    DATE_FORMAT(ngay, '%d/%m/%Y') AS ngayDisplay 
                FROM CaKham 
                WHERE id_bacSi = ? 
                  AND ngay >= ? 
                GROUP BY ngay 
                ORDER BY ngay ASC
            `;

            const [lichTruc] = await con.promise().query(sqlLich, [
                bacSiId,
                today
            ]);

            const sqlKhoa = `
                SELECT id_chuyenKhoa 
                FROM BacSi 
                WHERE id = ?
            `;

            const [khoa] = await con.promise().query(sqlKhoa, [bacSiId]);

            if (khoa.length === 0) {
                return res.json({
                    success: false,
                    message: 'Không tìm thấy thông tin chuyên khoa của bác sĩ.'
                });
            }

            const id_chuyenKhoa = khoa[0].id_chuyenKhoa;

            const sqlBacSiCungKhoa = `
                SELECT 
                    nd.id, 
                    nd.hoTen 
                FROM BacSi bs 
                JOIN NguoiDung nd ON bs.id = nd.id 
                WHERE bs.id_chuyenKhoa = ? 
                  AND bs.id != ?
            `;

            const [bacSiCungKhoa] = await con.promise().query(sqlBacSiCungKhoa, [
                id_chuyenKhoa,
                bacSiId
            ]);

            res.json({
                success: true,
                tenBacSi,
                lichTruc,
                bacSiCungKhoa
            });

        } catch (error) {
            console.error("Lỗi lấy thông tin đổi lịch:", error);

            res.status(500).json({
                success: false,
                message: 'Lỗi máy chủ'
            });
        }
    },

    guiYeuCauDoiLich: async (req, res) => {
        try {
            const bacSiId = req.session.user.id;

            const {
                ngayMuonDoi,
                id_bacSiThanhThe,
                ngayDoi,
                id_bacSiThayThe
            } = req.body;

            const ngayDoiFinal = ngayDoi || ngayMuonDoi;
            const idBacSiThayTheFinal = id_bacSiThayThe || id_bacSiThanhThe;

            if (!ngayDoiFinal || !idBacSiThayTheFinal) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng điền đủ thông tin.'
                });
            }

            const [lichTrucRows] = await con.promise().query(
                `
                SELECT id_caKham 
                FROM CaKham 
                WHERE id_bacSi = ? 
                  AND ngay = ?
                LIMIT 1
                `,
                [bacSiId, ngayDoiFinal]
            );

            if (lichTrucRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn không có lịch trực vào ngày đã chọn.'
                });
            }

            const [yeuCauCu] = await con.promise().query(
                `
                SELECT id_yeuCauDoiLich
                FROM YeuCauDoiLich
                WHERE id_bacSi = ?
                  AND ngayDoi = ?
                  AND trangThai = 'ChoDuyet'
                LIMIT 1
                `,
                [bacSiId, ngayDoiFinal]
            );

            if (yeuCauCu.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn đã gửi yêu cầu đổi lịch cho ngày này và đang chờ duyệt.'
                });
            }

            const [bacSiThayTheRows] = await con.promise().query(
                `
                SELECT 
                    bs.id,
                    nd.hoTen,
                    bs.id_chuyenKhoa
                FROM BacSi bs
                JOIN NguoiDung nd ON bs.id = nd.id
                WHERE bs.id = ?
                LIMIT 1
                `,
                [idBacSiThayTheFinal]
            );

            if (bacSiThayTheRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Không tìm thấy bác sĩ thay thế.'
                });
            }

            const [bacSiHienTaiRows] = await con.promise().query(
                `
                SELECT id_chuyenKhoa
                FROM BacSi
                WHERE id = ?
                LIMIT 1
                `,
                [bacSiId]
            );

            if (
                bacSiHienTaiRows.length > 0 &&
                bacSiThayTheRows[0].id_chuyenKhoa !== bacSiHienTaiRows[0].id_chuyenKhoa
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Bác sĩ thay thế phải cùng chuyên khoa.'
                });
            }

            const [trungLichThayThe] = await con.promise().query(
                `
                SELECT id_caKham
                FROM CaKham
                WHERE id_bacSi = ?
                  AND ngay = ?
                LIMIT 1
                `,
                [idBacSiThayTheFinal, ngayDoiFinal]
            );

            if (trungLichThayThe.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Bác sĩ thay thế đã có lịch trực vào ngày này.'
                });
            }

            const sqlInsertYeuCau = `
                INSERT INTO YeuCauDoiLich 
                    (id_bacSi, ngayDoi, id_bacSiThayThe, trangThai) 
                VALUES (?, ?, ?, 'ChoDuyet')
            `;

            const [result] = await con.promise().query(sqlInsertYeuCau, [
                bacSiId,
                ngayDoiFinal,
                idBacSiThayTheFinal
            ]);

            const idYeuCau = result.insertId;

            const [bsInfo] = await con.promise().query(
                `
                SELECT hoTen 
                FROM NguoiDung 
                WHERE id = ?
                `,
                [bacSiId]
            );

            const tenBacSi = bsInfo.length > 0 ? bsInfo[0].hoTen : `ID ${bacSiId}`;

            const [bsThayTheInfo] = await con.promise().query(
                `
                SELECT hoTen 
                FROM NguoiDung 
                WHERE id = ?
                `,
                [idBacSiThayTheFinal]
            );

            const tenBacSiThayThe = bsThayTheInfo.length > 0
                ? bsThayTheInfo[0].hoTen
                : `ID ${idBacSiThayTheFinal}`;

            const [admins] = await con.promise().query(
                `
                SELECT id 
                FROM NguoiDung 
                WHERE vaiTro = 'NguoiQuanLy'
                `
            );

            for (let admin of admins) {
                await con.promise().query(
                    `
                    INSERT INTO ThongBao 
                        (id_nguoiDung, tieuDe, noiDung, loaiThongBao, id_yeuCau) 
                    VALUES (?, ?, ?, 'YeuCauDoiLich', ?)
                    `,
                    [
                        admin.id,
                        'Yêu cầu đổi lịch mới',
                        `Bác sĩ ${tenBacSi} muốn đổi lịch trực ngày ${ngayDoiFinal} cho bác sĩ ${tenBacSiThayThe}.`,
                        idYeuCau
                    ]
                );
            }

            return res.json({
                success: true,
                message: 'Gửi yêu cầu thành công'
            });

        } catch (error) {
            console.error("Lỗi gửi yêu cầu đổi lịch:", error);

            return res.status(500).json({
                success: false,
                message: 'Đã xảy ra lỗi phía máy chủ.'
            });
        }
    }
};

module.exports = xemLichTruc;