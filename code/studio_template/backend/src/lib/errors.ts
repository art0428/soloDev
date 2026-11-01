/**
 * 統一錯誤格式（api/openapi.yaml 的 Error）：{ error: { code, message, details? } }。
 * message 給人看、寫完整句子、照 docs/ui-terms.md 用字；code 給程式看。
 */
export type ErrorDetail = { field: string; message: string }

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (message = '請求格式錯，請重新整理後再試一次。') => new AppError(400, 'BAD_REQUEST', message)
export const unauthorized = () => new AppError(401, 'UNAUTHORIZED', '請先登入。')
export const forbidden = () => new AppError(403, 'FORBIDDEN', '你沒有這個功能的使用權限。')
export const notFound = (what = '資料') => new AppError(404, 'NOT_FOUND', `找不到${what}。`)
export const validationFailed = (details: ErrorDetail[]) =>
  new AppError(422, 'VALIDATION_FAILED', '資料驗證失敗，請檢查標示的欄位。', details)

export type ErrorBody = { error: { code: string; message: string; details?: ErrorDetail[] | null } }

export function errorBody(code: string, message: string, details?: ErrorDetail[]): ErrorBody {
  return { error: details ? { code, message, details } : { code, message } }
}
