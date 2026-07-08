const { con } = require('../../config/connectDatabase'); 

// 1. Hiển thị danh sách phòng khám
const getQuanLyPhongKham = (req, res) => {
    const sql = `
        SELECT 
            P.soPhong, 
            P.tang, 
            P.ghiChu,
            CK.id_chuyenKhoa,
            CK.tenChuyenKhoa, 
            CK.moTa
        FROM Phong P
        LEFT JOIN ChuyenKhoa CK ON P.id_chuyenKhoa = CK.id_chuyenKhoa
        ORDER BY P.tang ASC, P.soPhong ASC;
    `;

    con.query(sql, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Lỗi lấy danh sách phòng khám");
        }
        
        res.render('admin/quanLyPhongKham/quanLyPhongKham', { 
            data: result 
        });
    });
};

// 2. Hiển thị form phân công (ĐÃ LỌC PHÒNG TRỐNG)
const getThemPhongMoi = (req, res) => {
    // Lấy danh sách Chuyên Khoa
    const sqlChuyenKhoa = "SELECT * FROM ChuyenKhoa";

    con.query(sqlChuyenKhoa, (err, listChuyenKhoa) => {
        if (err) {
            console.error("Lỗi lấy chuyên khoa:", err);
            return res.status(500).send("Lỗi hệ thống");
        }

        // ĐÃ SỬA: Chỉ lấy những phòng CHƯA ĐƯỢC PHÂN CÔNG (id_chuyenKhoa là NULL)
        const sqlPhongTrong = "SELECT * FROM Phong WHERE id_chuyenKhoa IS NULL ORDER BY soPhong ASC";
        
        con.query(sqlPhongTrong, (err, listPhong) => {
            if (err) {
                console.error("Lỗi lấy phòng:", err);
                return res.status(500).send("Lỗi hệ thống");
            }

            res.render('admin/quanLyPhongKham/themPhongMoi', { 
                listChuyenKhoa: listChuyenKhoa, 
                listPhong: listPhong 
            });
        });
    });
};

// 3. Xử lý phân công (UPDATE BẢNG PHONG)
const postThemPhongMoi = (req, res) => {
    const { id_chuyenKhoa, soPhong, ghiChu } = req.body;

    // Hàm load lại dữ liệu kèm thông báo lỗi khi validate thất bại
    const loadAndRenderError = (errorMessage) => {
        con.query("SELECT * FROM ChuyenKhoa", (err, listChuyenKhoa) => {
            // ĐÃ SỬA ĐỒNG BỘ: Ở đây cũng chỉ lấy phòng chưa được phân công
            con.query("SELECT * FROM Phong WHERE id_chuyenKhoa IS NULL ORDER BY soPhong ASC", (err, listPhong) => {
                res.render('admin/quanLyPhongKham/themPhongMoi', {
                    listChuyenKhoa: listChuyenKhoa,
                    listPhong: listPhong,
                    msg: errorMessage
                });
            });
        });
    };

    if (!id_chuyenKhoa || !soPhong) {
        return loadAndRenderError("Vui lòng chọn đầy đủ Chuyên khoa và Phòng!");
    }

    const sql = "UPDATE Phong SET id_chuyenKhoa = ?, ghiChu = ? WHERE soPhong = ?";

    con.query(sql, [id_chuyenKhoa, ghiChu, soPhong], (err, result) => {
        if (err) {
            console.error('Lỗi cập nhật phòng:', err.message);
            return loadAndRenderError("Lỗi hệ thống: Không thể phân công phòng.");
        }

        res.redirect('/admin/quanLyPhongKham');
    });
};

// 4. Xóa phân công (Set NULL để biến phòng đó thành phòng trống)
const xoaViTri = (req, res) => {
    const { soPhong } = req.params;

    const sql = "UPDATE Phong SET id_chuyenKhoa = NULL, ghiChu = NULL WHERE soPhong = ?";

    con.query(sql, [soPhong], (err, result) => {
        if (err) {
            console.error('Lỗi hủy phân công:', err);
            return res.status(500).send('Lỗi hệ thống khi hủy phân công');
        }

        res.redirect('/admin/quanLyPhongKham');
    });
};

module.exports = { 
    getQuanLyPhongKham,
    getThemPhongMoi,
    postThemPhongMoi,
    xoaViTri
};