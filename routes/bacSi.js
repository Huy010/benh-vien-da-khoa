const express = require('express');
const router = express.Router();
const bacSiDangNhap = require('../controllers/bacSi/bacSiDangNhap');
const { kiemTraDangNhapBacSi } = require('../controllers/bacSi/kiemTraDangNhapBacSi');
const xemLichTruc = require('../controllers/bacSi/xemLichTruc');
const khamBenh = require('../controllers/bacSi/khamBenh');
const chanDoan = require('../controllers/bacSi/chanDoan');
const thongBaoBacSi = require('../controllers/bacSi/thongBaoBacSi');
const demThongBaoBacSi = require('../controllers/bacSi/demThongBaoBacSi');
const lichSuKhamBenh = require('../controllers/bacSi/lichSuKhamBenh');

// ==========================================
// 1. CÁC ROUTE CÔNG KHAI (Không cần đăng nhập)
// ==========================================
// Đường dẫn: /bacsi/login
router.get('/login', bacSiDangNhap.getLogin);
router.post('/login', bacSiDangNhap.postLogin);
router.get('/logout', bacSiDangNhap.logout);


// ==========================================
// 2. CHỐT CHẶN BẢO VỆ TẤT CẢ ROUTE BÊN DƯỚI
// Mọi request đi xuống dưới dòng này đều bắt buộc phải vượt qua kiemTraDangNhapBacSi
// ==========================================
router.use(kiemTraDangNhapBacSi);
router.use(demThongBaoBacSi);


// ==========================================
// 3. CÁC ROUTE BẢO MẬT (Chắc chắn Bác Sĩ đã đăng nhập mới vào được)
// Nhờ có router.use() ở trên, ta không cần phải truyền middleware vào từng route nữa cho đỡ rườm rà.
// ==========================================

// Tổng quan
router.get('/tongQuan', (req, res) => {
    res.render('bacSi/tongQuan', { 
        user: req.session.user,
        message: '' // Tránh lỗi undefined biến message
    });
});

// Xem lịch trực
router.get('/xemLich', xemLichTruc.getLichTruc);
router.post('/yeuCauDoiLich', xemLichTruc.guiYeuCauDoiLich);
router.get('/thongTinDoiLich', xemLichTruc.layThongTinDoiLich);

// Khám bệnh
router.get('/khamBenh', khamBenh.getKhamBenh);
router.post('/khamBenh/tuDongHuy', khamBenh.tuDongHuy);
router.get('/khamBenh/api/danhSach', khamBenh.getDanhSachChoAPI);

// Chẩn Đoán
router.get('/khamBenh/chiTiet/:id', chanDoan.getChanDoan);
router.post('/khamBenh/hoanThanh/:id', chanDoan.postHoanThanhKham);

// Bác sĩ nhận thông báo
router.get('/thongBao', thongBaoBacSi.getDanhSachThongBao);
router.post('/thongBao/danhDauDaDoc/:id', thongBaoBacSi.danhDauDaDoc);
router.get('/thongBao/demChuaDoc', thongBaoBacSi.apiDemThongBaoChuaDoc);
router.get('/thongBao/chiTietYeuCau/:id', thongBaoBacSi.getChiTietYeuCau);

//Lịch sử khám bệnh
router.get('/lichsukhambenh', lichSuKhamBenh.getLichSuKhamBenh);


module.exports = router;