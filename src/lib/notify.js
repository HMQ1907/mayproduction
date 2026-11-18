import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'

export const notify = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg, { autoClose: 6000 }),
  info: (msg) => toast.info(msg),
}

/** Hộp xác nhận đẹp thay cho confirm() của trình duyệt. Trả về true nếu bấm đồng ý. */
export async function confirmDialog(text, { title = 'Xác nhận', confirmText = 'Đồng ý', danger = true } = {}) {
  const r = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Hủy',
    reverseButtons: true,
    focusCancel: true,
    background: '#1f1a17',
    color: '#f5efe9',
    confirmButtonColor: danger ? '#b91c1c' : '#f97316',
    cancelButtonColor: '#3a312b',
  })
  return r.isConfirmed
}
