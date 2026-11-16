import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/browser'

// Cột của file mẫu (thứ tự cố định để dễ điền)
export const TEMPLATE_HEADERS = [
  'Loại', 'Câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'Đáp án đúng', 'Ảnh (link)',
]

const ALIASES = {
  type: ['loai', 'type', 'dang'],
  content: ['cau hoi', 'cauhoi', 'question', 'noi dung'],
  a: ['dap an a', 'a', 'option a'],
  b: ['dap an b', 'b', 'option b'],
  c: ['dap an c', 'c', 'option c'],
  d: ['dap an d', 'd', 'option d'],
  answer: ['dap an dung', 'dap an', 'answer', 'correct', 'dung'],
  image: ['anh (link)', 'anh', 'hinh', 'hinh anh', 'image', 'image url', 'link anh'],
}

const strip = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim().replace(/\s+/g, ' ')

export function sampleCsv() {
  const rows = [
    TEMPLATE_HEADERS,
    ['Trắc nghiệm', 'Thủ đô của Việt Nam là gì?', 'Hà Nội', 'Đà Nẵng', 'Huế', 'TP.HCM', 'A', ''],
    ['Trắc nghiệm', '1 tuần có bao nhiêu ngày?', '5', '6', '7', '8', 'C', ''],
    ['Nhập chữ', 'Đuổi hình bắt chữ: đây là gì?', '', '', '', '', 'con mèo | mèo', 'https://example.com/hinh1.jpg'],
  ]
  return '﻿' + Papa.unparse(rows)
}

async function readRows(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text()
    return Papa.parse(text.replace(/^﻿/, ''), { skipEmptyLines: true }).data
  }
  if (name.endsWith('.xlsx')) return await readSheet(file)
  throw new Error('Chỉ hỗ trợ file .xlsx hoặc .csv (file .xls cũ hãy lưu lại thành .xlsx).')
}

/**
 * Đọc file -> { questions: [...], errors: [{row, msg}] }
 * question = { type, content, image_url, options, answer }
 */
export async function parseQuestionFile(file) {
  const raw = (await readRows(file)).map((r) => r.map((c) => (c == null ? '' : String(c).trim())))
  if (raw.length < 2) throw new Error('File không có dữ liệu.')

  // tìm dòng tiêu đề trong 5 dòng đầu
  let hi = raw.slice(0, 5).findIndex((r) => r.some((c) => ALIASES.content.includes(strip(c))))
  if (hi < 0) hi = 0
  const header = raw[hi].map(strip)
  const col = {}
  for (const [k, names] of Object.entries(ALIASES)) col[k] = header.findIndex((h) => names.includes(h))
  if (col.content < 0) throw new Error('Không tìm thấy cột "Câu hỏi". Hãy dùng đúng file mẫu.')
  if (col.answer < 0) throw new Error('Không tìm thấy cột "Đáp án đúng". Hãy dùng đúng file mẫu.')

  const questions = []
  const errors = []
  raw.slice(hi + 1).forEach((r, idx) => {
    const row = hi + idx + 2 // số dòng hiển thị trong Excel
    if (r.every((c) => c === '')) return
    const get = (k) => (col[k] >= 0 ? r[col[k]] ?? '' : '')
    const content = get('content')
    const answer = get('answer')
    const image = get('image')
    const opts = ['a', 'b', 'c', 'd'].map(get)
    const typeRaw = strip(get('type'))
    const isText = ['nhap chu', 'text', 'chu', 'dhbc', 'duoi hinh bat chu'].includes(typeRaw) ||
      (typeRaw === '' && opts.every((o) => o === ''))

    if (!content) return errors.push({ row, msg: 'Thiếu nội dung câu hỏi' })
    if (!answer) return errors.push({ row, msg: 'Thiếu đáp án đúng' })

    if (isText) {
      const acc = answer.split('|').map((x) => x.trim()).filter(Boolean)
      if (!acc.length) return errors.push({ row, msg: 'Thiếu đáp án đúng' })
      questions.push({ type: 'text', content, image_url: image || null, options: null, answer: acc.join('|') })
      return
    }

    const filled = opts.filter((o) => o !== '')
    if (filled.length < 2) return errors.push({ row, msg: 'Câu trắc nghiệm cần ít nhất 2 đáp án' })
    if (new Set(filled.map(strip)).size !== filled.length) return errors.push({ row, msg: 'Có đáp án bị trùng nhau' })
    let correct = null
    const letter = answer.trim().toUpperCase()
    if (/^[ABCD]$/.test(letter)) {
      const v = opts['ABCD'.indexOf(letter)]
      if (!v) return errors.push({ row, msg: `Đáp án đúng là ${letter} nhưng ô ${letter} đang trống` })
      correct = v
    } else {
      correct = filled.find((o) => strip(o) === strip(answer)) ?? null
      if (!correct) return errors.push({ row, msg: 'Đáp án đúng phải là A/B/C/D hoặc trùng với một đáp án' })
    }
    questions.push({ type: 'mcq', content, image_url: image || null, options: filled, answer: correct })
  })
  return { questions, errors }
}
