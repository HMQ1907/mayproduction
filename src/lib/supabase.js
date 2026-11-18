import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null

const ERRORS = {
  NOT_ACTIVE: 'Hiện chưa có tuần chơi nào đang mở.',
  BAD_NAME: 'Vui lòng nhập họ tên (2–60 ký tự).',
  NAME_TAKEN: 'Tên này đã chơi tuần này rồi. Mỗi người chỉ được chơi 1 lần mỗi tuần.',
  DEVICE_PLAYED: 'Thiết bị này đã chơi tuần này rồi. Hẹn bạn tuần sau nhé!',
  NOT_ENOUGH_QUESTIONS: 'Bộ câu hỏi tuần này chưa đủ. Vui lòng báo ban tổ chức.',
  BAD_CONFIG: 'Cấu hình tuần chơi chưa hợp lệ. Vui lòng báo ban tổ chức.',
  FORBIDDEN: 'Phiên chơi không hợp lệ.',
  FINISHED: 'Phiên chơi đã kết thúc.',
  PENDING: 'Hãy trả lời câu hỏi đang mở trước.',
  ALREADY_OPENED: 'Ô này đã được mở.',
  NO_PENDING: 'Không có câu hỏi nào đang mở.',
  NOT_STARTED: 'Tuần chơi này chưa đến giờ bắt đầu.',
  ENDED: 'Tuần chơi này đã kết thúc.',
  BAD_TIME: 'Giờ kết thúc phải sau giờ bắt đầu.',
  BAD_LOGIN: 'Sai tên đăng nhập hoặc mật khẩu.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
}

/** Gọi RPC, trả về data hoặc ném Error với message tiếng Việt. */
export async function rpc(name, args = {}) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase (.env).')
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    const code = Object.keys(ERRORS).find((c) => error.message?.includes(c))
    const e = new Error(code ? ERRORS[code] : error.message)
    e.code = code
    throw e
  }
  return data
}
