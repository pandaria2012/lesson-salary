/**
 * 小程序文件读写（**分包专用**，对应 Web 端 src/lib/export.ts 的保存层）。
 *
 * 平台差异（设计 §6.2）：
 * - 浏览器：Blob + URL.createObjectURL + <a download> / navigator.share / showSaveFilePicker
 * - 小程序：FileSystemManager.writeFile 写入 USER_DATA_PATH，再用 openDocument 预览
 *   或 shareFileMessage 转发。三者在两端都完全不存在对方的 API。
 */

const FS = () => wx.getFileSystemManager()
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type SaveResult = 'opened' | 'shared' | 'cancelled' | 'failed'

/** 把 ArrayBuffer 写成 xlsx 临时文件，返回文件路径 */
export function writeXlsxFile(buffer: ArrayBuffer, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
    FS().writeFile({
      filePath,
      data: buffer,
      success: () => resolve(filePath),
      fail: err => reject(new Error(`写入文件失败：${err.errMsg ?? '未知错误'}`))
    })
  })
}

/**
 * 用系统组件打开预览 xlsx。
 * 注意：openDocument 支持 xlsx，但不同机型/基础库表现有差异，
 * 失败时由调用方降级到 shareFileMessage。
 */
export function openDocument(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      fileType: 'xlsx',
      showMenu: true,
      success: () => resolve(),
      fail: err => reject(new Error(err.errMsg ?? '打开文件失败'))
    })
  })
}

/** 转发文件到聊天（发给文件传输助手即可长期保存） */
export function shareFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.shareFileMessage({
      filePath,
      fileName: filePath.split('/').pop(),
      success: () => resolve(),
      fail: err => reject(new Error(err.errMsg ?? '转发失败'))
    })
  })
}

/**
 * 保存并呈现 xlsx：先预览，预览不可用则降级为转发。
 * 返回实际走通的路径，便于页面给出准确提示。
 */
export async function saveAndPresent(buffer: ArrayBuffer, filename: string): Promise<SaveResult> {
  let filePath: string
  try {
    filePath = await writeXlsxFile(buffer, filename)
  } catch {
    return 'failed'
  }

  try {
    await openDocument(filePath)
    return 'opened'
  } catch {
    // 预览失败（部分机型/基础库不支持）→ 降级为转发
    try {
      await shareFile(filePath)
      return 'shared'
    } catch (err) {
      // 用户主动取消转发会走到这里，不视为错误
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('cancel') || msg.includes('取消')) return 'cancelled'
      return 'failed'
    }
  }
}

/** 从聊天记录选择 Excel 文件，返回 { tempFilePath, name } */
export function chooseExcelFile(): Promise<{ tempFilePath: string; name: string } | null> {
  return new Promise(resolve => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: res => {
        const f = res.tempFiles?.[0]
        if (!f) return resolve(null)
        resolve({ tempFilePath: f.path, name: f.name || '课程表.xlsx' })
      },
      // 用户取消不视为错误
      fail: () => resolve(null)
    })
  })
}

/**
 * 读取文件为**标准** ArrayBuffer。
 *
 * ⚠️ 必须复制一次，不能直接返回 `res.data`。
 *
 * 原因（已在模拟器中实测确认）：小程序运行时里 `FileSystemManager.readFile`
 * 返回的 ArrayBuffer **不满足 `instanceof ArrayBuffer`**（跨 realm / 非标准构造器）。
 * 而 SheetJS 内部正是用 `instanceof ArrayBuffer` 判断输入类型，
 * 判断失败后会走错解析分支 —— 表现为解析出空表：
 *     同一份 17002 字节的 xlsx：
 *       直接内存 buffer 解析     → sheet="上课记录", rows=5   ✅
 *       经 readFile 返回后解析   → sheet="Sheet1",   rows=0   ❌
 *       复制进 new ArrayBuffer() → 正常                      ✅
 * 字节本身完全一致（逐一比对 identical=true），问题只在对象类型。
 *
 * 复制成本：一次 O(n) 拷贝，Excel 量级（几百 KB）可忽略。
 */
export function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    FS().readFile({
      filePath,
      success: res => {
        const raw = res.data as ArrayBuffer
        // 归一化为标准 ArrayBuffer，保证 SheetJS 的类型判断能通过
        const normalized = new ArrayBuffer(raw.byteLength)
        new Uint8Array(normalized).set(new Uint8Array(raw))
        resolve(normalized)
      },
      fail: err => reject(new Error(`读取文件失败：${err.errMsg ?? '未知错误'}`))
    })
  })
}

export { XLSX_MIME }
