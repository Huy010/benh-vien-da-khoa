const { con } = require('../../config/connectDatabase');

function formatDateToDisplay(dateStr) {
    if (!dateStr) return '';

    if (dateStr.includes('/')) {
        return dateStr;
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatDateToSql(dateStr) {
    if (!dateStr) return '';

    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');

        if (parts.length !== 3) return dateStr;

        const day = parts[0];
        const month = parts[1];
        const year = parts[2];

        return `${year}-${month}-${day}`;
    }

    return dateStr;
}

function formatDateObjectToSql(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function addDaysSql(dateStr, days) {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() + days);
    return formatDateObjectToSql(date);
}

function getMondayOfWeek(dateObj) {
    const date = new Date(dateObj);
    const day = date.getDay(); // Chủ nhật = 0, Thứ 2 = 1
    const diff = day === 0 ? -6 : 1 - day;

    date.setDate(date.getDate() + diff);

    return date;
}

function getVietnameseWeekday(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay();

    const weekdays = [
        'Chủ nhật',
        'Thứ 2',
        'Thứ 3',
        'Thứ 4',
        'Thứ 5',
        'Thứ 6',
        'Thứ 7'
    ];

    return weekdays[day];
}

const thongKe = {
    getThongKe: async (req, res) => {
        try {
            const today = new Date();

            const year = today.getFullYear();
            const month = today.getMonth() + 1;

            const firstDayOfMonthSql = `${year}-${String(month).padStart(2, '0')}-01`;

            const lastDayOfMonth = new Date(year, month, 0);

            const lastDayOfMonthSql = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;

            const tuNgayDisplay = req.query.tuNgay || formatDateToDisplay(firstDayOfMonthSql);
            const denNgayDisplay = req.query.denNgay || formatDateToDisplay(lastDayOfMonthSql);

            const tuNgaySql = formatDateToSql(tuNgayDisplay);
            const denNgaySql = formatDateToSql(denNgayDisplay);

            const params = [tuNgaySql, denNgaySql];

            const sqlTongQuan = `
                SELECT 
                    COUNT(*) AS tongLuotDat,

                    SUM(CASE 
                        WHEN lh.trangThai = 'HoanThanh' THEN 1 
                        ELSE 0 
                    END) AS tongHoanThanh,

                    SUM(CASE 
                        WHEN lh.trangThai = 'DenTre' THEN 1 
                        ELSE 0 
                    END) AS tongDenTre,

                    SUM(CASE 
                        WHEN lh.trangThai = 'Huy' THEN 1 
                        ELSE 0 
                    END) AS tongHuy,

                    SUM(CASE 
                        WHEN lh.trangThai = 'ChoDuyet' THEN 1 
                        ELSE 0 
                    END) AS tongChoKham,

                    SUM(CASE 
                        WHEN lh.trangThaiThanhToan = 'DaThanhToan'
                             AND lh.trangThai != 'Huy'
                        THEN lh.donGia 
                        ELSE 0 
                    END) AS tongDoanhThu

                FROM LichHen lh
                INNER JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
                WHERE ck.ngay BETWEEN ? AND ?
            `;

            const [tongQuanRows] = await con.promise().query(sqlTongQuan, params);

            const tongQuan = {
                tongLuotDat: Number(tongQuanRows[0].tongLuotDat) || 0,
                tongHoanThanh: Number(tongQuanRows[0].tongHoanThanh) || 0,
                tongDenTre: Number(tongQuanRows[0].tongDenTre) || 0,
                tongHuy: Number(tongQuanRows[0].tongHuy) || 0,
                tongChoKham: Number(tongQuanRows[0].tongChoKham) || 0,
                tongDoanhThu: Number(tongQuanRows[0].tongDoanhThu) || 0
            };

            const sqlLuotKham = `
                SELECT 
                    ck.ngay AS ngay,
                    DATE_FORMAT(ck.ngay, '%d/%m/%Y') AS ngayHienThi,

                    COUNT(*) AS tongLuot,

                    SUM(CASE 
                        WHEN lh.trangThai = 'ChoDuyet' THEN 1 
                        ELSE 0 
                    END) AS choKham,

                    SUM(CASE 
                        WHEN lh.trangThai = 'HoanThanh' THEN 1 
                        ELSE 0 
                    END) AS hoanThanh,

                    SUM(CASE 
                        WHEN lh.trangThai = 'Huy' THEN 1 
                        ELSE 0 
                    END) AS huy,

                    SUM(CASE 
                        WHEN lh.trangThai = 'DenTre' THEN 1 
                        ELSE 0 
                    END) AS denTre

                FROM LichHen lh
                INNER JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
                WHERE ck.ngay BETWEEN ? AND ?
                GROUP BY ck.ngay
                ORDER BY ck.ngay ASC
            `;

            const [luotKhamRows] = await con.promise().query(sqlLuotKham, params);

            const thongKeLuotKham = luotKhamRows.map(row => {
                return {
                    ngay: row.ngay,
                    ngayHienThi: row.ngayHienThi,
                    tongLuot: Number(row.tongLuot) || 0,
                    choKham: Number(row.choKham) || 0,
                    hoanThanh: Number(row.hoanThanh) || 0,
                    huy: Number(row.huy) || 0,
                    denTre: Number(row.denTre) || 0
                };
            });

            const sqlDoanhThu = `
                SELECT 
                    ck.ngay AS ngay,
                    DATE_FORMAT(ck.ngay, '%d/%m/%Y') AS ngayHienThi,

                    SUM(CASE 
                        WHEN lh.trangThaiThanhToan = 'DaThanhToan'
                             AND lh.trangThai != 'Huy'
                        THEN 1 
                        ELSE 0 
                    END) AS luotDaThanhToan,

                    SUM(CASE 
                        WHEN lh.trangThaiThanhToan = 'DaHoanTien'
                        THEN 1 
                        ELSE 0 
                    END) AS luotHoanTien,

                    SUM(CASE 
                        WHEN lh.trangThaiThanhToan = 'DaThanhToan'
                             AND lh.trangThai != 'Huy'
                        THEN lh.donGia 
                        ELSE 0 
                    END) AS doanhThu

                FROM LichHen lh
                INNER JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
                WHERE ck.ngay BETWEEN ? AND ?
                GROUP BY ck.ngay
                ORDER BY ck.ngay ASC
            `;

            const [doanhThuRows] = await con.promise().query(sqlDoanhThu, params);

            const thongKeDoanhThu = doanhThuRows.map(row => {
                return {
                    ngay: row.ngay,
                    ngayHienThi: row.ngayHienThi,
                    luotDaThanhToan: Number(row.luotDaThanhToan) || 0,
                    luotHoanTien: Number(row.luotHoanTien) || 0,
                    doanhThu: Number(row.doanhThu) || 0
                };
            });

            // ================== THỐNG KÊ LƯỢNG KHÁCH THEO TUẦN ==================

            const currentMondaySql = formatDateObjectToSql(getMondayOfWeek(today));

            const tuanBatDauSql = req.query.tuanBatDau
                ? formatDateToSql(req.query.tuanBatDau)
                : currentMondaySql;

            const tuanKetThucSql = addDaysSql(tuanBatDauSql, 6);

            const tuanTruocSql = addDaysSql(tuanBatDauSql, -7);
            const tuanSauSql = addDaysSql(tuanBatDauSql, 7);

            const ngayKhachHangSql = req.query.ngayKhachHang
                ? formatDateToSql(req.query.ngayKhachHang)
                : formatDateObjectToSql(today);

            const ngayKhachHangDisplay = formatDateToDisplay(ngayKhachHangSql);

            const weekUrlsBase = `tuNgay=${encodeURIComponent(tuNgayDisplay)}&denNgay=${encodeURIComponent(denNgayDisplay)}&ngayKhachHang=${encodeURIComponent(ngayKhachHangDisplay)}`;

            const tuanTruocUrl = `/admin/thongKe?${weekUrlsBase}&tuanBatDau=${tuanTruocSql}#khach-hang-pane`;
            const tuanSauUrl = `/admin/thongKe?${weekUrlsBase}&tuanBatDau=${tuanSauSql}#khach-hang-pane`;

            const danhSachNgayTrongTuan = [];

            for (let i = 0; i < 7; i++) {
                const ngaySql = addDaysSql(tuanBatDauSql, i);

                danhSachNgayTrongTuan.push({
                    ngay: ngaySql,
                    ngayHienThi: formatDateToDisplay(ngaySql),
                    thu: getVietnameseWeekday(ngaySql),
                    tongKhach: 0
                });
            }

            const sqlKhachTheoTuan = `
                SELECT 
                    ck.ngay AS ngay,
                    DATE_FORMAT(ck.ngay, '%Y-%m-%d') AS ngaySql,
                    DATE_FORMAT(ck.ngay, '%d/%m/%Y') AS ngayHienThi,
                    COUNT(*) AS tongKhach
                FROM LichHen lh
                INNER JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
                WHERE ck.ngay BETWEEN ? AND ?
                  AND lh.trangThai != 'Huy'
                GROUP BY ck.ngay
                ORDER BY ck.ngay ASC
            `;

            const [khachTheoTuanRows] = await con.promise().query(sqlKhachTheoTuan, [
                tuanBatDauSql,
                tuanKetThucSql
            ]);

            const mapKhachTheoNgay = {};

            khachTheoTuanRows.forEach(row => {
                mapKhachTheoNgay[row.ngaySql] = Number(row.tongKhach) || 0;
            });

            const thongKeKhachTheoTuan = danhSachNgayTrongTuan.map(item => {
                return {
                    ...item,
                    tongKhach: mapKhachTheoNgay[item.ngay] || 0
                };
            });

            const sqlKhachTheoGio = `
                SELECT 
                    HOUR(lh.gioHen) AS gio,
                    COUNT(*) AS tongKhach
                FROM LichHen lh
                INNER JOIN CaKham ck ON lh.id_caKham = ck.id_caKham
                WHERE ck.ngay = ?
                  AND lh.trangThai != 'Huy'
                  AND HOUR(lh.gioHen) BETWEEN 7 AND 17
                GROUP BY HOUR(lh.gioHen)
                ORDER BY gio ASC
            `;

            const [khachTheoGioRows] = await con.promise().query(sqlKhachTheoGio, [
                ngayKhachHangSql
            ]);

            const mapKhachTheoGio = {};

            khachTheoGioRows.forEach(row => {
                mapKhachTheoGio[Number(row.gio)] = Number(row.tongKhach) || 0;
            });

            const thongKeKhachTheoGio = [];

            for (let gio = 7; gio <= 17; gio++) {
                thongKeKhachTheoGio.push({
                    gio,
                    khungGio: `${String(gio).padStart(2, '0')}:00 - ${String(gio).padStart(2, '0')}:59`,
                    tongKhach: mapKhachTheoGio[gio] || 0
                });
            }

            const tongKhachTrongTuan = thongKeKhachTheoTuan.reduce((sum, item) => {
                return sum + item.tongKhach;
            }, 0);

            const tongKhachTrongNgay = thongKeKhachTheoGio.reduce((sum, item) => {
                return sum + item.tongKhach;
            }, 0);

            res.render('admin/thongKe', {
                page: 'thongKe',
                user: req.session.user,
                tuNgay: tuNgayDisplay,
                denNgay: denNgayDisplay,
                tongQuan,
                thongKeLuotKham,
                thongKeDoanhThu,

                tuanBatDau: formatDateToDisplay(tuanBatDauSql),
                tuanKetThuc: formatDateToDisplay(tuanKetThucSql),
                tuanTruocUrl,
                tuanSauUrl,
                ngayKhachHang: ngayKhachHangDisplay,
                thongKeKhachTheoTuan,
                thongKeKhachTheoGio,
                tongKhachTrongTuan,
                tongKhachTrongNgay
            });

        } catch (error) {
            console.error("Lỗi tải trang thống kê:", error);
            res.status(500).send("Lỗi tải trang thống kê");
        }
    }
};

module.exports = thongKe;