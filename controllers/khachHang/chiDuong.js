
const getChiDuong = (req, res) => {
    res.render('khachHang/chiDuong', {
        page: 'chiDuong',
        user: req.session.user || null,
        // Maptiles Key dùng để hiện bản đồ
        goongMapKey: "QgSyhEtbLzl3NFBJIzL6seJzO1gK1SpdKWCrgaHS",
        // API Key dùng để gọi Autocomplete và Place Detail
        goongApiKey: "FOHy7yD0xfLQ2p0X7x8s1eVdlt4ptAnjQk97JbOD"
    });
};

module.exports = {
    getChiDuong,
};