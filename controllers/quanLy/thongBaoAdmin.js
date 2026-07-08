const { con } = require('../../config/connectDatabase');

const thongBaoAdmin = {
    getDanhSachThongBao: async (req, res) => {
        try {
            const userID = req.session.user.id;

            const limit = 10;
            let page = parseInt(req.query.page) || 1;
            if (page < 1) page = 1;

            const offset = (page - 1) * limit;

            const countSql = `
                SELECT COUNT(*) AS total 
                FROM ThongBao 
                WHERE id_nguoiDung = ?
            `;

            const [countResult] = await con.promise().query(countSql, [userID]);

            const totalThongBao = countResult[0].total;
            const totalPages = Math.ceil(totalThongBao / limit);

            const sql = `
                SELECT tb.*
                FROM ThongBao tb
                WHERE tb.id_nguoiDung = ?
                ORDER BY tb.id_thongBao DESC
                LIMIT ? OFFSET ?
            `;

            const [thongBaoList] = await con.promise().query(sql, [
                userID,
                Number(limit),
                Number(offset)
            ]);

            res.render('admin/thongBao', {
                thongBaoList,
                currentPage: page,
                totalPages: totalPages
            });

        } catch (error) {
            console.error("Lỗi tải thông báo admin:", error);
            res.status(500).send("Lỗi tải thông báo");
        }
    },

    danhDauDaDoc: async (req, res) => {
        try {
            const idTb = req.params.id;

            const sql = `
                UPDATE ThongBao 
                SET trangThaiDoc = TRUE 
                WHERE id_thongBao = ? AND id_nguoiDung = ?
            `;

            await con.promise().query(sql, [idTb, req.session.user.id]);

            res.json({ success: true });

        } catch (error) {
            console.error("Lỗi đánh dấu thông báo đã đọc:", error);
            res.json({ success: false });
        }
    },

    getChiTietYeuCau: async (req, res) => {
        try {
            const idYc = req.params.id;

            const sql = `
                SELECT 
                    yc.*,

                    DATE_FORMAT(yc.ngayDoi, '%d/%m/%Y') AS ngayDoiStr,
                    DATE_FORMAT(yc.ngayDoi, '%d/%m/%Y') AS ngayMuonDoiStr,
                    DATE_FORMAT(yc.ngayDoi, '%Y-%m-%d') AS ngayDoiValue,
                    DATE_FORMAT(yc.ngayDoi, '%Y-%m-%d') AS ngayMuonDoi,

                    yc.id_bacSiThayThe AS id_bacSiThanhThe,

                    DATE_FORMAT(yc.ngayDoi, '%Y-%m-%d') AS dateCompare,
                    DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS todayStr,

                    nd1.hoTen AS tenBsYeuCau,
                    nd2.hoTen AS tenBsThayThe,
                    nd3.hoTen AS tenNguoiDuyet
                FROM YeuCauDoiLich yc
                LEFT JOIN NguoiDung nd1 ON yc.id_bacSi = nd1.id
                LEFT JOIN NguoiDung nd2 ON yc.id_bacSiThayThe = nd2.id
                LEFT JOIN NguoiDung nd3 ON yc.id_nguoiQuanLy = nd3.id
                WHERE yc.id_yeuCauDoiLich = ?
            `;

            const [rows] = await con.promise().query(sql, [idYc]);

            if (rows.length === 0) {
                return res.json({
                    success: false,
                    message: 'Không tìm thấy dữ liệu yêu cầu đổi lịch.'
                });
            }

            const yeuCau = rows[0];
            const isExpired = yeuCau.dateCompare < yeuCau.todayStr;

            res.json({
                success: true,
                yeuCau,
                isExpired
            });

        } catch (error) {
            console.error("Lỗi getChiTietYeuCau:", error);
            res.status(500).json({ success: false });
        }
    },

    xuLyYeuCau: async (req, res) => {
        try {
            const { idYeuCau, hanhDong } = req.body;
            const idAdmin = req.session.user.id;

            const isDuyet =
                hanhDong === 'DaDuyet' ||
                hanhDong === 'Duyet' ||
                hanhDong === 'duyet' ||
                hanhDong === 'approve';

            const [ycArr] = await con.promise().query(
                `
                SELECT * 
                FROM YeuCauDoiLich 
                WHERE id_yeuCauDoiLich = ?
                `,
                [idYeuCau]
            );

            if (ycArr.length === 0) {
                return res.json({
                    success: false,
                    message: 'Không tìm thấy yêu cầu.'
                });
            }

            const yc = ycArr[0];

            if (yc.trangThai !== 'ChoDuyet') {
                return res.json({
                    success: false,
                    message: 'Yêu cầu này đã được xử lý trước đó.'
                });
            }

            const bsId = yc.id_bacSi;
            const bsThayTheId = yc.id_bacSiThayThe;

            const [info] = await con.promise().query(
                `
                SELECT 
                    DATE_FORMAT(?, '%Y-%m-%d') AS dateCompare,
                    DATE_FORMAT(?, '%d/%m/%Y') AS ngayStr,
                    DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS todayStr
                `,
                [yc.ngayDoi, yc.ngayDoi]
            );

            const { dateCompare, ngayStr, todayStr } = info[0];

            if (isDuyet && dateCompare < todayStr) {
                return res.json({
                    success: false,
                    message: `Không thể duyệt! Ngày trực (${ngayStr}) đã qua so với hôm nay (${todayStr}). Vui lòng bấm TỪ CHỐI để hủy bỏ.`
                });
            }

            const dateMuonDoiStr = dateCompare;

            if (isDuyet) {
                const [caKham] = await con.promise().query(
                    `
                    SELECT * 
                    FROM CaKham 
                    WHERE id_bacSi = ? AND ngay = ?
                    `,
                    [bsId, dateMuonDoiStr]
                );

                if (caKham.length === 0) {
                    await con.promise().query(
                        `
                        UPDATE YeuCauDoiLich 
                        SET trangThai = 'TuChoi', id_nguoiQuanLy = ? 
                        WHERE id_yeuCauDoiLich = ?
                        `,
                        [idAdmin, idYeuCau]
                    );

                    return res.json({
                        success: false,
                        message: 'Lỗi: Bác sĩ không có ca khám vào ngày này hoặc lịch đã được đổi từ trước!'
                    });
                }

                const [trungLichThayThe] = await con.promise().query(
                    `
                    SELECT id_caKham
                    FROM CaKham
                    WHERE id_bacSi = ? AND ngay = ?
                    LIMIT 1
                    `,
                    [bsThayTheId, dateMuonDoiStr]
                );

                if (trungLichThayThe.length > 0) {
                    return res.json({
                        success: false,
                        message: 'Không thể duyệt vì bác sĩ thay thế đã có lịch trực vào ngày này.'
                    });
                }

                await con.promise().query(
                    `
                    UPDATE CaKham 
                    SET id_bacSi = ? 
                    WHERE id_bacSi = ? AND ngay = ?
                    `,
                    [bsThayTheId, bsId, dateMuonDoiStr]
                );

                await con.promise().query(
                    `
                    UPDATE YeuCauDoiLich 
                    SET trangThai = 'DaDuyet', id_nguoiQuanLy = ? 
                    WHERE id_yeuCauDoiLich = ?
                    `,
                    [idAdmin, idYeuCau]
                );

                await con.promise().query(
                    `
                    UPDATE YeuCauDoiLich 
                    SET trangThai = 'TuChoi', id_nguoiQuanLy = ? 
                    WHERE id_bacSi = ? 
                      AND DATE(ngayDoi) = ? 
                      AND trangThai = 'ChoDuyet'
                      AND id_yeuCauDoiLich != ?
                    `,
                    [idAdmin, bsId, dateMuonDoiStr, idYeuCau]
                );

                await con.promise().query(
                    `
                    INSERT INTO ThongBao 
                        (id_nguoiDung, tieuDe, noiDung, loaiThongBao, id_yeuCau) 
                    VALUES (?, ?, ?, 'KetQuaDuyet', ?)
                    `,
                    [
                        bsId,
                        'Yêu cầu đổi lịch ĐƯỢC DUYỆT',
                        `Yêu cầu đổi lịch trực ngày ${ngayStr} của bạn đã được Admin phê duyệt.`,
                        idYeuCau
                    ]
                );

                await con.promise().query(
                    `
                    INSERT INTO ThongBao 
                        (id_nguoiDung, tieuDe, noiDung, loaiThongBao, id_yeuCau) 
                    VALUES (?, ?, ?, 'KetQuaDuyet', ?)
                    `,
                    [
                        bsThayTheId,
                        'Lịch trực mới ĐƯỢC THÊM',
                        `Bạn đã được phân công trực thay ngày ${ngayStr}. Vui lòng kiểm tra lịch trực của bạn.`,
                        idYeuCau
                    ]
                );

            } else {
                await con.promise().query(
                    `
                    UPDATE YeuCauDoiLich 
                    SET trangThai = 'TuChoi', id_nguoiQuanLy = ? 
                    WHERE id_yeuCauDoiLich = ?
                    `,
                    [idAdmin, idYeuCau]
                );

                await con.promise().query(
                    `
                    INSERT INTO ThongBao 
                        (id_nguoiDung, tieuDe, noiDung, loaiThongBao, id_yeuCau) 
                    VALUES (?, ?, ?, 'KetQuaDuyet', ?)
                    `,
                    [
                        bsId,
                        'Yêu cầu đổi lịch BỊ TỪ CHỐI',
                        `Yêu cầu đổi lịch trực ngày ${ngayStr} của bạn đã bị Admin từ chối.`,
                        idYeuCau
                    ]
                );

                if (bsThayTheId) {
                    await con.promise().query(
                        `
                        INSERT INTO ThongBao 
                            (id_nguoiDung, tieuDe, noiDung, loaiThongBao, id_yeuCau) 
                        VALUES (?, ?, ?, 'KetQuaDuyet', ?)
                        `,
                        [
                            bsThayTheId,
                            'Yêu cầu trực thay BỊ TỪ CHỐI',
                            `Yêu cầu trực thay ngày ${ngayStr} đã bị Admin từ chối hoặc hủy bỏ.`,
                            idYeuCau
                        ]
                    );
                }
            }

            res.json({
                success: true,
                message: 'Đã xử lý yêu cầu thành công.'
            });

        } catch (error) {
            console.error("Lỗi xử lý yêu cầu đổi lịch:", error);

            res.status(500).json({
                success: false,
                message: 'Lỗi server trong quá trình xử lý.'
            });
        }
    },

    apiDemThongBaoChuaDoc: async (req, res) => {
        try {
            const userID = req.session.user.id;

            const sql = `
                SELECT COUNT(*) AS soLuong 
                FROM ThongBao 
                WHERE id_nguoiDung = ? AND trangThaiDoc = FALSE
            `;

            const [result] = await con.promise().query(sql, [userID]);

            res.json({
                success: true,
                count: result[0].soLuong
            });

        } catch (error) {
            console.error("Lỗi đếm thông báo chưa đọc admin:", error);
            res.json({ success: false });
        }
    }
};

module.exports = thongBaoAdmin;