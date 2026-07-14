const express = require('express');

// Tạo ra một đối tượng "Router"
const router = express.Router();

// Import file controller vào
const home = require("../controllers/khachHang/home");
const khachHangDangNhap = require("../controllers/khachHang/khachHangDangNhap");
const khachHangThayDoiThongTin = require("../controllers/khachHang/khachHangThayDoiThongTin");
const chiDuong = require("../controllers/khachHang/chiDuong");
const { kiemTraDangNhap } = require("../controllers/khachHang/xacThucKhachHang");


// Import 3 file controller vừa được tách ra
const datLichThuong = require("../controllers/khachHang/datLichThuong");
const datLichChuyenGia = require("../controllers/khachHang/datLichChuyenGia");
const thanhToan = require("../controllers/khachHang/thanhToan");

// ================= PUBLIC ROUTES (Ai cũng vào được) =================
router.get('/', home.getHome);
router.get('/trangchu', home.getHome);
router.get('/thongtin', home.getThongTin);

// Trang địa chỉ khám bệnh tích hợp Google Map
router.get('/diaChiKhamBenh', (req, res) => {
    res.render('khachHang/diaChiKhamBenh', {
        page: 'diaChiKhamBenh',
        user: req.session.user || null
    });
});

// Đăng nhập & Tạo tài khoản
router.get('/login', khachHangDangNhap.getLogin);
router.post('/login', khachHangDangNhap.postLogin);
router.get('/logout', khachHangDangNhap.logout);

router.get('/khachhangtaotaikhoan', khachHangDangNhap.getTaoTaiKhoan);
router.post('/khachhangtaotaikhoan', khachHangDangNhap.postTaoTaiKhoan);

// API lấy dữ liệu (Public để AJAX có thể gọi dễ dàng trên giao diện)
router.get('/api/slots', datLichThuong.getSlots);
router.get('/api/bacsi', datLichChuyenGia.getBacSiByChuyenKhoa);
router.get('/api/slotsChuyenGia', datLichChuyenGia.getSlotsChuyenGia);

// Webhook của ZaloPay (ZaloPay gọi ngầm về Server, tuyệt đối KHÔNG chặn đăng nhập)
router.post('/callback', thanhToan.callbackZaloPay);

// ================= PRIVATE ROUTES (Bắt buộc đăng nhập) =================

// 1. TRANG CHỌN HÌNH THỨC ĐẶT LỊCH
router.get('/datlichhen', kiemTraDangNhap, datLichThuong.getChonHinhThuc);

// 2. LUỒNG ĐẶT LỊCH KHÁM THƯỜNG
router.get('/datLichThuong', kiemTraDangNhap, datLichThuong.getDatLich);
router.post('/datlichhen', kiemTraDangNhap, datLichThuong.postDatLich);

// 3. LUỒNG ĐẶT LỊCH KHÁM CHUYÊN GIA
router.get('/datLichChuyenGia', kiemTraDangNhap, datLichChuyenGia.getDatLichChuyenGia);
router.get('/datLichChuyenGia/chonThoiGian', kiemTraDangNhap, datLichChuyenGia.getChonThoiGian);
router.post('/datLichChuyenGia', kiemTraDangNhap, datLichChuyenGia.postDatLichChuyenGia);

// Lịch sử và thao tác với lịch đặt khám
router.get('/lichSuDatLichKham', kiemTraDangNhap, thanhToan.getLichSu);
router.post('/huyLich', kiemTraDangNhap, thanhToan.huyLichHen);
router.post('/thanhToanLai', kiemTraDangNhap, thanhToan.thanhToanLai);
router.get('/thongTinLichKham', kiemTraDangNhap, thanhToan.getThongTinLichKham);

// Thay đổi thông tin cá nhân
router.get('/thayDoiThongTin', kiemTraDangNhap, khachHangThayDoiThongTin.getThayDoiThongTin);
router.post('/capNhatThongTin', kiemTraDangNhap, khachHangThayDoiThongTin.postCapNhatThongTin);

// Chi duong
router.get('/chiDuong', chiDuong.getChiDuong);

// "Đóng gói" để xuất bản
module.exports = router;