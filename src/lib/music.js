// Nhạc nền của tuần: mp3/ogg, tối đa 2MB mỗi lần import
export const MUSIC_MAX_BYTES = 2 * 1024 * 1024
export const MUSIC_MAX_LABEL = '2MB'

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Không đọc được file.'))
    r.readAsDataURL(file)
  })
}

function checkPlayable(dataUrl) {
  return new Promise((resolve, reject) => {
    const a = new Audio()
    const t = setTimeout(() => reject(new Error('Không đọc được file âm thanh này.')), 8000)
    a.onloadedmetadata = () => { clearTimeout(t); resolve(a.duration) }
    a.onerror = () => { clearTimeout(t); reject(new Error('File không phải âm thanh hợp lệ (cần MP3 hoặc OGG).')) }
    a.src = dataUrl
  })
}

/** Kiểm tra dung lượng và định dạng, trả về data URL để lưu. */
export async function processMusic(file) {
  const okType = /^audio\/(mpeg|mp3|ogg)$/.test(file.type) || /\.(mp3|ogg)$/i.test(file.name)
  if (!okType) throw new Error('Chỉ nhận file MP3 hoặc OGG.')
  if (file.size > MUSIC_MAX_BYTES) {
    throw new Error(`File quá nặng: ${(file.size / 1048576).toFixed(2)}MB. Giới hạn mỗi lần import là ${MUSIC_MAX_LABEL}.`)
  }
  const url = await readDataUrl(file)
  const duration = await checkPlayable(url)
  return { url, duration, size: file.size }
}
