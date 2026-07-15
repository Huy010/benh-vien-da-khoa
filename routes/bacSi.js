const express = require('express');
const router = express.Router();

const bacSiDangNhap = require('../controllers/bacSi/bacSiDangNhap');
const {
    kiemTraDangNhapBacSi
} = require('../controllers/bacSi/kiemTraDangNhapBacSi');

const xemLichTruc = require('../controllers/bacSi/xemLichTruc');
const khamBenh = require('../controllers/bacSi/khamBenh');
const chanDoan = require('../controllers/bacSi/chanDoan');
const thongBaoBacSi = require('../controllers/bacSi/thongBaoBacSi');
const demThongBaoBacSi = require('../controllers/bacSi/demThongBaoBacSi');
const lichSuKhamBenh = require('../controllers/bacSi/lichSuKhamBenh');

// =====================================================
// 1. CÁC ROUTE CÔNG KHAI
// Không yêu cầu bác sĩ đăng nhập
// =====================================================

// Đăng nhập bác sĩ
router.get('/login', bacSiDangNhap.getLogin);
router.post('/login', bacSiDangNhap.postLogin);

// Đăng xuất bác sĩ
router.get('/logout', bacSiDangNhap.logout);

// =====================================================
// 2. MIDDLEWARE BẢO VỆ CÁC ROUTE BÊN DƯỚI
// =====================================================

router.use(kiemTraDangNhapBacSi);
router.use(demThongBaoBacSi);

// =====================================================
// 3. CÁC ROUTE DÀNH CHO BÁC SĨ ĐÃ ĐĂNG NHẬP
// =====================================================

// Tổng quan
router.get('/tongQuan', (req, res) => {
    return res.render('bacSi/tongQuan', {
        page: 'tongQuan',
        user: req.session.user,
        message: ''
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

// Chẩn đoán
router.get('/khamBenh/chiTiet/:id', chanDoan.getChanDoan);

router.post('/khamBenh/hoanThanh/:id', chanDoan.postHoanThanhKham);

// Thông báo bác sĩ
router.get('/thongBao', thongBaoBacSi.getDanhSachThongBao);

router.post('/thongBao/danhDauDaDoc/:id', thongBaoBacSi.danhDauDaDoc);

router.get('/thongBao/demChuaDoc', thongBaoBacSi.apiDemThongBaoChuaDoc);

router.get('/thongBao/chiTietYeuCau/:id', thongBaoBacSi.getChiTietYeuCau);

// Lịch sử khám bệnh
router.get('/lichSuKhamBenh',lichSuKhamBenh.getLichSuKhamBenh);

module.exports = router;