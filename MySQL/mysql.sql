DROP DATABASE IF EXISTS datlichonline;
CREATE DATABASE datlichonline;
USE datlichonline;

-- ================= 1. TẠO CÁC BẢNG (THEO THỨ TỰ PHỤ THUỘC) =================

-- Bảng gốc cho mọi tài khoản
CREATE TABLE NguoiDung (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenDangNhap VARCHAR(50) NOT NULL UNIQUE,
    matKhau VARCHAR(255) NOT NULL,
    vaiTro ENUM('KhachHang', 'BacSi', 'NguoiQuanLy') NOT NULL,
    hoTen VARCHAR(100) NOT NULL,
    soDienThoai VARCHAR(10),
    email VARCHAR(100),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng chuyên khoa (Phải có trước Bác sĩ và Phòng)
CREATE TABLE ChuyenKhoa (
    id_chuyenKhoa INT AUTO_INCREMENT PRIMARY KEY,
    tenChuyenKhoa VARCHAR(100) NOT NULL,
    moTa TEXT
);

-- Bảng Khách hàng (Kế thừa từ NguoiDung)
CREATE TABLE KhachHang (
    id INT PRIMARY KEY,
    ngaySinh DATE,
    gioiTinh ENUM('Nam', 'Nu', 'Khac'),
    diaChi VARCHAR(255),
    tienSuBenhLy TEXT,
    nhomMau VARCHAR(5),
    FOREIGN KEY (id) REFERENCES NguoiDung(id) ON DELETE CASCADE
);

-- Bảng Người quản lý (Kế thừa từ NguoiDung)
CREATE TABLE NguoiQuanLy (
    id INT PRIMARY KEY,
    ngayNhanViec DATE,
    boPhan VARCHAR(100),
    FOREIGN KEY (id) REFERENCES NguoiDung(id) ON DELETE CASCADE
);

-- Bảng Bác sĩ (Kết hợp từ NguoiDung và ChuyenKhoa)
CREATE TABLE BacSi (
    id INT PRIMARY KEY,
    namTotNghiep INT,
    chiTiet TEXT,
    id_chuyenKhoa INT,
    FOREIGN KEY (id) REFERENCES NguoiDung(id) ON DELETE CASCADE,
    FOREIGN KEY (id_chuyenKhoa) REFERENCES ChuyenKhoa(id_chuyenKhoa)
);

-- Bảng Phòng (Khai báo đầy đủ cấu trúc từ đầu)
CREATE TABLE Phong (
    soPhong INT PRIMARY KEY, 
    tang INT NOT NULL,
    id_chuyenKhoa INT NULL,
    ghiChu TEXT NULL,
    CONSTRAINT fk_phong_chuyenkhoa 
    FOREIGN KEY (id_chuyenKhoa) REFERENCES ChuyenKhoa(id_chuyenKhoa) ON DELETE SET NULL
);

-- Bảng Ca Khám (Phụ thuộc vào Bác sĩ)
CREATE TABLE CaKham (
    id_caKham INT AUTO_INCREMENT PRIMARY KEY,
    ngay DATE NOT NULL,
    id_bacSi INT NOT NULL,    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    
    FOREIGN KEY (id_bacSi) REFERENCES BacSi(id) ON DELETE CASCADE,
    UNIQUE KEY unique_phan_cong (ngay, id_bacSi)
);

-- Bảng Lịch Hẹn (Bảng đích tổng hợp thông tin)
CREATE TABLE LichHen (
    id_lichHen INT AUTO_INCREMENT PRIMARY KEY,
    id_caKham INT NOT NULL,      
    id_khachHang INT,            
    id_chuyenKhoa INT,
    gioHen TIME NOT NULL,  
    trangThai ENUM('ChoDuyet', 'DaDuyet', 'Huy', 'HoanThanh') DEFAULT 'ChoDuyet',
    ghiChu TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    
    FOREIGN KEY (id_caKham) REFERENCES CaKham(id_caKham) ON DELETE CASCADE,    
    FOREIGN KEY (id_chuyenKhoa) REFERENCES ChuyenKhoa(id_chuyenKhoa),    
    FOREIGN KEY (id_khachHang) REFERENCES KhachHang(id)
);


-- ================= 2. CHÈN DỮ LIỆU MẪU BAN ĐẦU =================

-- Chèn Chuyên Khoa
INSERT INTO ChuyenKhoa (tenChuyenKhoa, moTa) VALUES 
('Khoa Nội', 'Chẩn đoán và điều trị các bệnh nội tiết, tim mạch, tiêu hóa bằng thuốc.'),
('Khoa Ngoại', 'Thực hiện các thủ thuật phẫu thuật để điều trị bệnh lý hoặc chấn thương.'),
('Khoa Nhi', 'Khám, điều trị bệnh lý và chăm sóc sức khỏe toàn diện cho trẻ em.'),
('Khoa Sản', 'Theo dõi thai kỳ, chăm sóc sức khỏe phụ khoa và hỗ trợ sinh nở.'),
('Khoa Tai – mũi – họng', 'Điều trị các bệnh lý liên quan đến tai, mũi, họng và vùng đầu cổ.');

-- Chèn Phòng bệnh
INSERT INTO Phong (soPhong, tang) VALUES 
(101, 1), (102, 1), (103, 1), (104, 1), (105, 1), (106, 1),
(201, 2), (202, 2), (203, 2), (204, 2), (205, 2), (206, 2);

-- Chèn tài khoản gốc cho Người Quản Lý (Sẽ tự sinh ID = 1)
INSERT INTO NguoiDung(tenDangNhap, matKhau, vaiTro, hoTen, soDienThoai, email) 
VALUES ("quanLy1", "quanLy1", "NguoiQuanLy", "Quản lý 1", "0988776666", "quanly1@gmail.com");

-- Chèn thông tin chi tiết Quản lý ứng với ID = 1 vừa tạo
INSERT INTO NguoiQuanLy(id, ngayNhanViec, boPhan)
VALUES (1, STR_TO_DATE('23-01-2025', '%d-%m-%Y'), "Ban giám đốc");


-- ================= 3. KIỂM TRA SAU KHI IMPORT =================
SHOW TABLES;
SELECT * FROM NguoiDung;
SELECT * FROM NguoiQuanLy;