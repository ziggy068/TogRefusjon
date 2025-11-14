Add-Type -AssemblyName System.Drawing

# Create 192x192 icon
$bmp192 = New-Object System.Drawing.Bitmap(192, 192)
$g192 = [System.Drawing.Graphics]::FromImage($bmp192)
$g192.Clear([System.Drawing.Color]::FromArgb(59, 130, 246))
$font = New-Object System.Drawing.Font('Arial', 80, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g192.DrawString('TR', $font, $brush, 30, 50)
$g192.Dispose()
$bmp192.Save('D:\TogRefusjon\frontend\public\icon-192.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp192.Dispose()

# Create 512x512 icon
$bmp512 = New-Object System.Drawing.Bitmap(512, 512)
$g512 = [System.Drawing.Graphics]::FromImage($bmp512)
$g512.Clear([System.Drawing.Color]::FromArgb(59, 130, 246))
$font512 = New-Object System.Drawing.Font('Arial', 200, [System.Drawing.FontStyle]::Bold)
$g512.DrawString('TR', $font512, $brush, 80, 130)
$g512.Dispose()
$bmp512.Save('D:\TogRefusjon\frontend\public\icon-512.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()

# Cleanup
$brush.Dispose()
$font.Dispose()
$font512.Dispose()

Write-Host "Icons created successfully"
