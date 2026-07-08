const { con } = require('../../config/connectDatabase');

const thongBaoBacSi = {
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

            res.render('bacSi/thongBao', {
                thongBaoList,
                currentPage: page,
                totalPages,
                user: req.session.user
            });
        } catch (error) {
            console.error("Lỗi tải thông báo bác sĩ:", error);
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
            console.error("Lỗi đánh dấu đã đọc:", error);
            res.json({ success: false });
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
            console.error("Lỗi đếm thông báo chưa đọc:", error);
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

            if (rows.length > 0) {
                res.json({
                    success: true,
                    yeuCau: rows[0]
                });
            } else {
                res.json({ success: false });
            }
        } catch (error) {
            console.error("Lỗi getChiTietYeuCau bên Bác sĩ:", error);
            res.status(500).json({ success: false });
        }
    }
};

module.exports = thongBaoBacSi;