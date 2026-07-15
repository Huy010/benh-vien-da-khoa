const con = require('../../config/connectDatabase');

// Tạo hàm query dùng Promise từ biến con
const query = async (sql, params = []) => {
    const [rows] = await con.promise().query(sql, params);
    return rows;
};

const nodemailer = require('nodemailer');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const moment = require('moment');

/* ================= CẤU HÌNH ZALOPAY SANDBOX ================= */
const configZaloPay = {
    app_id: "2553",
    key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
    key2: "kLtgPl8YESVaqxThlG89YNCQhJkNTtj1",
    endpoint: "https://sb-openapi.zalopay.vn/v2/create"
};

const TIMES = [
    "07:00","08:00","09:00","10:00","11:00",
    "13:00","14:00","15:00","16:00"
];

/* ================= CẤU HÌNH GỬI MAIL ================= */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'giahuykg941@gmail.com', // THAY BẰNG EMAIL CỦA BẠN 
        pass: 'mpepucgyeludawfd' // THAY BẰNG MẬT KHẨU ỨNG DỤNG LẤY TỪ GOOGLE
    }
});

/* ================= HELPER ================= */
function makeLocalDate(yyyyMMdd, timeHHMM) {
    const [y, m, d] = yyyyMMdd.split('-').map(Number);
    const [hh, mm] = timeHHMM.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0);
}

/* ======================================================
   API AJAX → trả JSON slots (KHÔNG reload trang)
   GET /api/slots?ngay=YYYY-MM-DD&id_chuyenKhoa=1
====================================================== */
const getSlots = async (req, res) => {
    const now = new Date();
    try {
        const { ngay, id_chuyenKhoa } = req.query;

        if (!ngay || !id_chuyenKhoa) {
            return res.json({ success: false, msg: 'Thiếu thông tin ngày hoặc chuyên khoa' });
        }

        const caKham = await query(
            `SELECT ck.id_caKham 
             FROM CaKham ck
             JOIN BacSi bs ON ck.id_bacSi = bs.id
             WHERE ck.ngay = ? AND bs.id_chuyenKhoa = ?
             LIMIT 1`,
            [ngay, id_chuyenKhoa]
        );

        if (!caKham.length) {
            const slots = TIMES.map(time => {
                const dt = makeLocalDate(ngay, time);
                const tooLate = dt < now;
                return { time, disabled: true };
            });
            return res.json({ success: true, slots, msg: 'Không có lịch làm việc ngày này' });
        }

        const id_ca = caKham[0].id_caKham;
        
        // ĐẾM SLOT: Gom nhóm theo 2 ký tự đầu của giờ
        const rows = await query(
            `SELECT SUBSTRING(gioHen, 1, 2) as hourPart, COUNT(*) as total 
             FROM LichHen 
             WHERE id_caKham = ? AND trangThai != 'Huy' 
             GROUP BY SUBSTRING(gioHen, 1, 2)`,
            [id_ca]
        );

        const map = {};
        rows.forEach(r => {
            const timeString = `${r.hourPart}:00`; 
            map[timeString] = r.total;
        });

        const slots = TIMES.map(time => {
            const dt = makeLocalDate(ngay, time);
            const tooLate = dt < now;
            const count = map[time] || 0;
            const disabled = tooLate || count >= 6; 
            return { time, disabled };
        });

        return res.json({ success: true, slots });

    } catch (err) {
        console.error('[getSlots] Lỗi:', err);
        res.json({ success: false, msg: 'Lỗi server' });
    }
};

/* ================= GET PAGE ================= */
const getDatLich = async (req, res) => {
    try {
        const chuyenKhoa = await query("SELECT * FROM ChuyenKhoa");
        res.render("khachHang/datLich/datLichHen", {
            page: "lichhen",
            chuyenKhoa,
            user: req.session.user
        });
    } catch (error) {
        console.error("Lỗi khi load trang đặt lịch:", error);
        res.status(500).send("Lỗi server");
    }
};

/* ================= POST ĐẶT LỊCH & TẠO THANH TOÁN ZALOPAY ================= */
const postDatLich = async (req, res) => {
    const { id_chuyenKhoa, ngay, gioHen } = req.body;

    if (!req.session || !req.session.user) {
        return res.json({ success: false, msg: 'Vui lòng đăng nhập để đặt lịch!' });
    }

    const id_khachHang = req.session.user.id; 

    try {
        const caKham = await query(
            `SELECT ck.id_caKham FROM CaKham ck
             JOIN BacSi bs ON ck.id_bacSi = bs.id
             WHERE ck.ngay = ? AND bs.id_chuyenKhoa = ? LIMIT 1`,
            [ngay, id_chuyenKhoa]
        );

        if (!caKham.length) {
            return res.json({ success: false, msg: 'Hiện chưa có lịch làm việc của bác sĩ.' });
        }
        const id_ca = caKham[0].id_caKham;

        const giaKhamData = await query(
            `SELECT donGia FROM GiaKham 
             WHERE id_chuyenKhoa = ? AND ngayApDung <= ? 
             ORDER BY ngayApDung DESC LIMIT 1`,
            [id_chuyenKhoa, ngay]
        );
        const donGia = giaKhamData.length > 0 ? giaKhamData[0].donGia : 150000; 

        // 🛑 BƯỚC 3: TÍNH TOÁN CỘNG GIỜ VÀ CHỐNG OVERBOOKING (ĐÃ ĐƯỢC FIX LỖI HỦY LỊCH)
        // Lấy 2 ký tự đầu của giờ (VD: '08')
        const gioHenPrefix = gioHen.substring(0, 2) + '%'; 
        
        // Truy vấn tất cả các giờ đã được đặt thành công trong khung giờ này
        const bookedData = await query(
            `SELECT gioHen FROM LichHen 
             WHERE id_caKham = ? AND gioHen LIKE ? AND trangThai != 'Huy'`,
            [id_ca, gioHenPrefix]
        );

        // Trích xuất danh sách các số phút đã bị chiếm dụng (VD: [0, 20])
        const bookedMinutes = bookedData.map(row => {
            const timeStr = typeof row.gioHen === 'string' ? row.gioHen : String(row.gioHen);
            return parseInt(timeStr.split(':')[1], 10);
        });

        // 6 mốc phút cho phép trong 1 khung giờ
        const possibleMinutes = [0, 10, 20, 30, 40, 50];
        let availableMinute = -1;

        // Tìm mốc phút đầu tiên còn trống (lấp chỗ trống của người đã hủy nếu có)
        for (let m of possibleMinutes) {
            if (!bookedMinutes.includes(m)) {
                availableMinute = m;
                break;
            }
        }

        // Nếu mảng kín không còn chỗ nào
        if (availableMinute === -1) {
            return res.json({ 
                success: false, 
                msg: 'Rất tiếc, khung giờ này đã kín người đặt. Vui lòng chọn giờ khác!' 
            });
        }

        // Tính toán giờ hẹn thực tế dựa trên số phút trống tìm được
        const hh = parseInt(gioHen.substring(0, 2), 10);
        const exactTimeObj = moment().set({ hour: hh, minute: availableMinute, second: 0 });
        const gioHenThucTe = exactTimeObj.format('HH:mm');

        // Insert dữ liệu với giờ hẹn chính xác (gioHenThucTe)
        const insertQuery = `
            INSERT INTO LichHen(id_caKham, id_khachHang, id_chuyenKhoa, gioHen, donGia, trangThai)
            VALUES (?, ?, ?, ?, ?, 'ChuaThanhToan')
        `;

        const insertResult = await query(insertQuery, [
            id_ca, id_khachHang, id_chuyenKhoa, gioHenThucTe, donGia
        ]);

        const id_lichHen_new = insertResult.insertId;

        // 💸 BƯỚC 4: TẠO GIAO DỊCH ZALOPAY
        const transID = Math.floor(Math.random() * 1000000);
        const app_trans_id = `${moment().format('YYMMDD')}_${transID}_${id_lichHen_new}`; 

        await query(`UPDATE LichHen SET maZalo = ? WHERE id_lichHen = ?`, [app_trans_id, id_lichHen_new]);

        const order = {
            app_id: Number(configZaloPay.app_id), 
            app_trans_id: app_trans_id, 
            app_user: "Khach_Hang_" + id_khachHang, 
            app_time: Date.now(),
            item: JSON.stringify([{ id_lichHen: id_lichHen_new, id_chuyenKhoa: id_chuyenKhoa }]), 
            embed_data: JSON.stringify({ redirecturl: `http://localhost:3000/lichSuDatLichKham` }),
            amount: Number(donGia), 
            description: `Thanh toan phi dat lich kham - Ma Don: #${id_lichHen_new}`, 
            bank_code: "",
            callback_url: "https://jona-intercollege-tammy.ngrok-free.dev/callback" 
        };

        const dataMac = configZaloPay.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
        order.mac = CryptoJS.HmacSHA256(dataMac, configZaloPay.key1).toString();

        const response = await axios.post(configZaloPay.endpoint, order);
        
        if (response.data.return_code === 1) {
            return res.json({ success: true, payUrl: response.data.order_url });
        } else {
            console.log("Lỗi ZaloPay chi tiết:", response.data);
            await query(`DELETE FROM LichHen WHERE id_lichHen = ?`, [id_lichHen_new]);
            return res.json({ success: false, msg: 'Không thể khởi tạo cổng thanh toán ZaloPay' });
        }

    } catch (error) {
        console.error("Lỗi đặt lịch:", error);
        return res.json({ success: false, msg: 'Lỗi server' });
    }
};

/* ================= LỊCH SỬ KHÁM ================= */
const getLichSu = async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const id_khachHang = req.session.user.id;
        
        // Đã sửa thành 10 để hiển thị 10 lịch sử 1 trang
        const limit = 10; 
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;

        const countSql = `SELECT COUNT(*) as total FROM LichHen WHERE id_khachHang = ?`;
        const countResult = await query(countSql, [id_khachHang]);
        const totalRows = countResult[0].total;
        const totalPages = Math.ceil(totalRows / limit);

        const sql = `
            SELECT 
                lh.id_lichHen, lh.donGia, ck.id_chuyenKhoa, ck.tenChuyenKhoa, 
                c.ngay, lh.gioHen, lh.trangThai,
                nd.hoTen as tenBacSi,
                lh.ghiChu
            FROM LichHen lh
            JOIN CaKham c ON lh.id_caKham = c.id_caKham
            JOIN ChuyenKhoa ck ON lh.id_chuyenKhoa = ck.id_chuyenKhoa
            LEFT JOIN BacSi bs ON c.id_bacSi = bs.id
            LEFT JOIN NguoiDung nd ON bs.id = nd.id
            WHERE lh.id_khachHang = ?
            ORDER BY c.ngay DESC, lh.gioHen DESC
            LIMIT ? OFFSET ?
        `;

        const rows = await query(sql, [id_khachHang, limit, offset]);

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lichSuFormat = [];

        for (let item of rows) {
            const dateObj = new Date(item.ngay);
            const gioStr = typeof item.gioHen === 'string' ? item.gioHen.substring(0, 5) : item.gioHen;

            dateObj.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
            
            let isCoTheHuy = false;
            
            if (item.trangThai === 'ChuaThanhToan') {
                isCoTheHuy = true; 
            } else if (item.trangThai === 'DaThanhToan') {
                isCoTheHuy = diffDays >= 2;
            }

            const [hh, mm] = gioStr.split(':').map(Number);
            const exactDateTime = new Date(item.ngay);
            exactDateTime.setHours(hh, mm, 0, 0);

            let isCoTheXemVe = false;
            if (item.trangThai === 'DaThanhToan' && exactDateTime >= now) {
                isCoTheXemVe = true;
            }

            lichSuFormat.push({
                ...item,
                ngay: moment(item.ngay).format('DD/MM/YYYY'),
                gioHen: gioStr,
                coTheHuy: isCoTheHuy,
                coTheXemVe: isCoTheXemVe 
            });
        }

        res.render('khachHang/datLich/lichSuDatLich', { 
            page: 'lichSuDatLich',
            lichSu: lichSuFormat,
            user: req.session.user,
            pagination: {
                currentPage: page,
                totalPages: totalPages
            }
        });

    } catch (error) {
        console.error("Lỗi khi lấy lịch sử đặt lịch:", error);
        res.status(500).send("Lỗi server");
    }
};

/* ================= HỦY LỊCH HẸN & HOÀN TIỀN ZALOPAY ================= */
const huyLichHen = async (req, res) => {
    try {
        const { id_lichHen } = req.body;

        const lichHenList = await query(`
            SELECT lh.*, c.ngay 
            FROM LichHen lh 
            JOIN CaKham c ON lh.id_caKham = c.id_caKham 
            WHERE lh.id_lichHen = ?
        `, [id_lichHen]);

        if (lichHenList.length === 0) {
            return res.json({ success: false, msg: 'Không tìm thấy lịch hẹn!' });
        }
        const lichHen = lichHenList[0];

        if (lichHen.trangThai === 'ChuaThanhToan') {
            await query(`DELETE FROM LichHen WHERE id_lichHen = ?`, [id_lichHen]);
            return res.json({ success: true, msg: 'Đã hủy bỏ lịch hẹn!' });
        }

        if (lichHen.trangThai === 'DaThanhToan') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const dateObj = new Date(lichHen.ngay);
            dateObj.setHours(0, 0, 0, 0);
            
            const diffDays = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 2) {
                return res.json({ success: false, msg: 'Không thể hủy lịch đã thanh toán khi thời gian khám còn dưới 2 ngày!' });
            }

            if (!lichHen.zp_trans_id) {
                return res.json({ success: false, msg: 'Không thể hoàn tiền do thiếu mã giao dịch ZaloPay.' });
            }

            const timestamp = Date.now();
            const uid = `${timestamp}${Math.floor(111 + Math.random() * 999)}`;
            const m_refund_id = `${moment().format('YYMMDD')}_${configZaloPay.app_id}_${uid}`;
            const description = `Hoan tien huy don ${id_lichHen}`; 

            let params = {
                app_id: Number(configZaloPay.app_id),
                m_refund_id: m_refund_id,
                timestamp: timestamp,
                zp_trans_id: lichHen.zp_trans_id,
                amount: Number(lichHen.donGia),
                description: description
            };

            let dataMac = params.app_id + "|" + params.zp_trans_id + "|" + params.amount + "|" + params.description + "|" + params.timestamp;
            params.mac = CryptoJS.HmacSHA256(dataMac, configZaloPay.key1).toString();

            const refundResponse = await axios.post("https://sb-openapi.zalopay.vn/v2/refund", params);

            if (refundResponse.data.return_code === 1 || refundResponse.data.return_code === 3) {
                await query(`UPDATE LichHen SET trangThai = 'DaHoanTien' WHERE id_lichHen = ?`, [id_lichHen]);
                return res.json({ success: true, msg: 'Hủy lịch và hoàn tiền thành công!' });
            } else {
                return res.json({ success: false, msg: 'Lỗi hoàn tiền: ' + refundResponse.data.return_message });
            }
        }

    } catch (error) {
        console.error("❌ Lỗi khi hủy lịch & hoàn tiền:", error);
        return res.json({ success: false, msg: 'Lỗi server khi hủy lịch' });
    }
};

/* ================= THANH TOÁN LẠI ZALOPAY ================= */
const thanhToanLai = async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.json({ success: false, msg: 'Hết phiên làm việc, vui lòng đăng nhập lại!' });
        }

        const { id_lichHen, donGia, id_chuyenKhoa } = req.body;
        const id_khachHang = req.session.user.id;

        const transID = Math.floor(Math.random() * 1000000);
        const app_trans_id = `${moment().format('YYMMDD')}_${transID}_${id_lichHen}`; 
        
        await query(`UPDATE LichHen SET maZalo = ? WHERE id_lichHen = ?`, [app_trans_id, id_lichHen]);

        const order = {
            app_id: Number(configZaloPay.app_id), 
            app_trans_id: app_trans_id, 
            app_user: "Khach_Hang_" + id_khachHang, 
            app_time: Date.now(),
            item: JSON.stringify([{ id_lichHen: id_lichHen, id_chuyenKhoa: id_chuyenKhoa }]),
            embed_data: JSON.stringify({ redirecturl: `http://localhost:3000/lichSuDatLichKham` }),
            amount: Number(donGia), 
            description: `Thanh toan phi dat lich kham - Ma Don: #${id_lichHen}`,
            bank_code: "", 
            callback_url: "https://jona-intercollege-tammy.ngrok-free.dev/callback"
        };

        const dataMac = configZaloPay.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
        order.mac = CryptoJS.HmacSHA256(dataMac, configZaloPay.key1).toString();

        const response = await axios.post(configZaloPay.endpoint, order);
        
        if (response.data.return_code === 1) {
            return res.json({ success: true, payUrl: response.data.order_url });
        } else {
            return res.json({ success: false, msg: 'Không thể tạo cổng thanh toán ZaloPay' });
        }
    } catch (error) {
        console.error("Lỗi khi thanh toán lại:", error);
        return res.json({ success: false, msg: 'Lỗi server' });
    }
};

/* ================= API CALLBACK ZALOPAY ================= */
const callbackZaloPay = async (req, res) => {
    let result = {};
    try {
        let dataStr = req.body.data;
        let dataJson = JSON.parse(dataStr);
        const app_trans_id = dataJson.app_trans_id;

        const updateResult = await query(
            `UPDATE LichHen SET trangThai = 'DaThanhToan', zp_trans_id = ? WHERE maZalo = ?`, 
            [dataJson.zp_trans_id, app_trans_id] 
        );

        if (updateResult.affectedRows > 0) {
            const infoRows = await query(`
                SELECT lh.*, nd.email, nd.hoTen, ck.tenChuyenKhoa, ca.ngay
                FROM LichHen lh
                JOIN NguoiDung nd ON lh.id_khachHang = nd.id
                JOIN ChuyenKhoa ck ON lh.id_chuyenKhoa = ck.id_chuyenKhoa
                JOIN CaKham ca ON lh.id_caKham = ca.id_caKham
                WHERE lh.maZalo = ?
            `, [app_trans_id]);

            if (infoRows.length > 0) {
                const data = infoRows[0];
                
                // Giờ hẹn đã được lưu chính xác trong DB, chỉ cần lấy ra gửi mail
                data.gioHenChinhXac = typeof data.gioHen === 'string' ? data.gioHen.substring(0, 5) : data.gioHen;

                if (data.email) {
                    sendSuccessEmail(data.email, data);
                } else {
                    console.log(`⚠️ Bỏ qua gửi mail vì tài khoản (ID: ${data.id_khachHang}) không có email.`);
                }
            }

            result.return_code = 1;
            result.return_message = "success";
        } else {
            console.log(`⚠️ THẤT BẠI: Không tìm thấy mã giao dịch ${app_trans_id} hoặc đã cập nhật trước đó.`);
            result.return_code = 0;
            result.return_message = "not found";
        }
        
    } catch (ex) {
        console.error("❌ LỖI CALLBACK:", ex.message);
        result.return_code = 0;
        result.return_message = ex.message;
    }
    res.json(result);
};

/* ================= HELPER: GỬI EMAIL THÔNG BÁO ================= */
const sendSuccessEmail = async (email, details) => {
    const mailOptions = {
        from: '"Phòng Khám Đa Khoa" <giahuykg941@gmail.com>',
        to: email,
        subject: 'Xác nhận thanh toán thành công - Lịch hẹn khám bệnh',
        html: `
            <div style="font-family: sans-serif; line-height: 1.5;">
                <h2 style="color: #2e7d32;">Thanh toán thành công!</h2>
                <p>Chào bạn,</p>
                <p>Phòng khám đã nhận được thanh toán cho lịch hẹn của bạn. Dưới đây là thông tin chi tiết:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Mã lịch hẹn:</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #1565c0;">LH-${details.id_lichHen}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Chuyên khoa:</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${details.tenChuyenKhoa}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Thời gian dự kiến:</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #d32f2f;">${details.gioHenChinhXac} - ${moment(details.ngay).format('DD/MM/YYYY')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Số tiền đã thanh toán:</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${details.donGia.toLocaleString()} VNĐ</td>
                    </tr>
                </table>
                <p>Vui lòng đến trước giờ hẹn từ 5-10 phút để làm thủ tục. Cảm ơn bạn đã tin tưởng chúng tôi!</p>
                <hr>
                <p style="font-size: 12px; color: #888;">Đây là email tự động, vui lòng không phản hồi email này.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Đã gửi email xác nhận đến: ${email}`);
    } catch (error) {
        console.error("❌ Lỗi gửi email:", error);
    }
};

/* ================= TIẾN TRÌNH CHẠY NGẦM (CRONJOB) ================= */
setInterval(async () => {
    try {
        const sql = `
            DELETE FROM LichHen 
            WHERE trangThai = 'ChuaThanhToan' 
            AND created_at <= (NOW() - INTERVAL 5 MINUTE)
        `;
        
        const result = await query(sql);
        
        if (result.affectedRows > 0) {
            console.log(`🧹 [Dọn dẹp] Đã tự động xóa ${result.affectedRows} lịch hẹn treo do quá 5 phút không thanh toán.`);
        }
    } catch (error) {
        console.error("Lỗi Cronjob dọn dẹp 5 phút:", error);
    }
}, 60000); 

/* ================= THÔNG TIN LỊCH KHÁM (VÉ ĐIỆN TỬ) ================= */
const getThongTinLichKham = async (req, res) => {
    try {
        const id_lichHen = req.query.id;
        if (!id_lichHen) return res.redirect('/lichSuDatLichKham');

        const infoRows = await query(`
            SELECT lh.*, nd.hoTen, ck.tenChuyenKhoa, ca.ngay
            FROM LichHen lh
            JOIN NguoiDung nd ON lh.id_khachHang = nd.id
            JOIN ChuyenKhoa ck ON lh.id_chuyenKhoa = ck.id_chuyenKhoa
            JOIN CaKham ca ON lh.id_caKham = ca.id_caKham
            WHERE lh.id_lichHen = ?
        `, [id_lichHen]);

        if (infoRows.length === 0) return res.redirect('/lichSuDatLichKham');
        
        const data = infoRows[0];

        if (data.trangThai !== 'DaThanhToan') {
            return res.redirect('/lichSuDatLichKham');
        }
        
        data.gioHenChinhXac = typeof data.gioHen === 'string' ? data.gioHen.substring(0, 5) : data.gioHen;
        data.ngayFormat = moment(data.ngay).format('DD/MM/YYYY');

        res.render('khachHang/datLich/thongTinLichKham', {
            page: 'thongTinLichKham',
            user: req.session.user,
            data: data
        });
    } catch (error) {
        console.error("Lỗi lấy thông tin lịch khám:", error);
        res.redirect('/');
    }
};

/* ================= EXPORT MODULES ================= */
module.exports = {
    getDatLich,
    postDatLich,
    getSlots,
    getLichSu,
    huyLichHen,
    thanhToanLai,
    callbackZaloPay,
    getThongTinLichKham
};