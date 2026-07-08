const getHome = (req, res) => {
    res.render('khachHang/trangChu', {
        page: 'trangChu',
        user: req.session.user || null // <-- Truyền null nếu không có session
    });
};

const getThongTin = (req, res) => {
    res.render('khachHang/thongTin', { page: 'thongTin' });
};
module.exports = {
    getHome,
    getThongTin
};