$ErrorActionPreference = "Stop"

Write-Host "Dang cai cac thu vien frontend vao node_modules..." -ForegroundColor Cyan

npm install `
    bootstrap@5.3.8 `
    sweetalert2@11 `
    @fortawesome/fontawesome-free@6.4.0 `
    maplibre-gl@5.24.0 `
    @mapbox/polyline@1.2.1 `
    chart.js@4 `
    flatpickr@4.6.13 `
    html2canvas@1.4.1

Write-Host ""
Write-Host "Cai dat hoan tat." -ForegroundColor Green
Write-Host "Hay chay: npm start" -ForegroundColor Yellow
