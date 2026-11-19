// Kiểu nền có sẵn (không cần upload ảnh). Mỗi nền là một gradient.
export const PRESETS = [
  { key: 'halloween', name: 'Halloween', css: 'radial-gradient(circle at 18% 12%, #6d28d9 0, transparent 46%), radial-gradient(circle at 85% 88%, #c2410c 0, transparent 42%), linear-gradient(160deg, #140a1f, #1d0f2e)' },
  { key: 'noel', name: 'Giáng sinh', css: 'radial-gradient(circle at 15% 10%, #15803d 0, transparent 46%), radial-gradient(circle at 88% 86%, #b91c1c 0, transparent 46%), linear-gradient(160deg, #08140d, #10231a)' },
  { key: 'tet', name: 'Tết', css: 'radial-gradient(circle at 82% 8%, #dc2626 0, transparent 52%), radial-gradient(circle at 10% 92%, #f59e0b 0, transparent 42%), linear-gradient(160deg, #3b0a0a, #5a1010)' },
  { key: 'ocean', name: 'Đại dương', css: 'radial-gradient(circle at 20% 10%, #0ea5e9 0, transparent 48%), radial-gradient(circle at 85% 90%, #14b8a6 0, transparent 44%), linear-gradient(160deg, #04121f, #0a2236)' },
  { key: 'sunset', name: 'Hoàng hôn', css: 'radial-gradient(circle at 80% 12%, #f43f5e 0, transparent 48%), radial-gradient(circle at 12% 88%, #f59e0b 0, transparent 46%), linear-gradient(160deg, #2a0f2e, #3d1630)' },
  { key: 'forest', name: 'Rừng xanh', css: 'radial-gradient(circle at 22% 14%, #22c55e 0, transparent 44%), radial-gradient(circle at 82% 86%, #84cc16 0, transparent 40%), linear-gradient(160deg, #06150b, #0d2615)' },
  { key: 'night', name: 'Đêm sao', css: 'radial-gradient(circle at 70% 15%, #6366f1 0, transparent 46%), radial-gradient(circle at 15% 85%, #8b5cf6 0, transparent 42%), linear-gradient(160deg, #0b0d1f, #151a38)' },
]

export const presetCss = (key) => PRESETS.find((p) => p.key === key)?.css || null
