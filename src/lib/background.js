// Template ảnh nền khi chơi: bắt buộc đúng kích thước này (dọc 9:16)
export const BG_W = 1080
export const BG_H = 1920
const MAX_FILE_MB = 8
const MAX_OUT_CHARS = 1_600_000 // ~1.2MB sau khi nén

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh. Hãy dùng file JPG, PNG hoặc WebP.')) }
    img.src = url
  })
}

/** Kiểm tra kích thước rồi nén thành JPEG data URL để lưu trong DB. */
export async function processBackground(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP.')
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Ảnh quá nặng (tối đa ${MAX_FILE_MB}MB).`)
  const img = await loadImage(file)
  if (img.naturalWidth !== BG_W || img.naturalHeight !== BG_H) {
    throw new Error(`Sai kích thước: ảnh của bạn là ${img.naturalWidth}×${img.naturalHeight}px, template yêu cầu đúng ${BG_W}×${BG_H}px.`)
  }
  const canvas = document.createElement('canvas')
  canvas.width = BG_W
  canvas.height = BG_H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, BG_W, BG_H)
  ctx.drawImage(img, 0, 0)
  for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length <= MAX_OUT_CHARS) return url
  }
  throw new Error('Ảnh quá phức tạp, không nén nhỏ hơn được. Hãy giảm chi tiết hoặc xuất ảnh JPG chất lượng thấp hơn.')
}

/** Tạo khung mẫu PNG có vùng an toàn để thiết kế theo. */
export function downloadGuide() {
  const c = document.createElement('canvas')
  c.width = BG_W
  c.height = BG_H
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, BG_H)
  g.addColorStop(0, '#3b2a4a')
  g.addColorStop(1, '#1b1226')
  x.fillStyle = g
  x.fillRect(0, 0, BG_W, BG_H)
  x.strokeStyle = 'rgba(255,255,255,.35)'
  x.lineWidth = 4
  x.setLineDash([24, 16])
  x.strokeRect(60, 220, BG_W - 120, BG_H - 440)
  x.setLineDash([])
  x.fillStyle = 'rgba(255,255,255,.9)'
  x.textAlign = 'center'
  x.font = 'bold 64px sans-serif'
  x.fillText(`${BG_W} × ${BG_H} px`, BG_W / 2, 140)
  x.font = '40px sans-serif'
  x.fillText('Vùng nét đứt = nơi hiển thị bảng ô và câu hỏi', BG_W / 2, 320)
  x.fillText('Đặt họa tiết chính ở sát mép trên và dưới', BG_W / 2, 380)
  x.fillText('Giữa ảnh nên tối hoặc đơn giản để chữ dễ đọc', BG_W / 2, 440)
  x.fillText('Xuất JPG, PNG hoặc WebP đúng kích thước', BG_W / 2, BG_H - 120)
  c.toBlob((b) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = `khung-mau-${BG_W}x${BG_H}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  })
}
