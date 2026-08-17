import 'server-only';

export type ProblemCode =
  | 'bad_request'
  | 'invalid_input'
  | 'forbidden_origin'
  | 'payload_too_large'
  | 'rate_limited'
  | 'auth'
  | 'login_required'
  | 'gmail_not_connected'
  | 'quota_exhausted'
  | 'timeout'
  | 'aborted'
  | 'upstream_unavailable'
  | 'content_filtered'
  | 'invalid_output'
  | 'unsupported_capability'
  | 'document_encrypted'
  | 'document_no_text'
  | 'unsupported_file_type'
  | 'unknown';

const STATUS: Record<ProblemCode, number> = {
  bad_request: 400,
  invalid_input: 422,
  forbidden_origin: 403,
  payload_too_large: 413,
  rate_limited: 429,
  auth: 401,
  login_required: 401,
  gmail_not_connected: 401,
  quota_exhausted: 429,
  timeout: 504,
  aborted: 499,
  upstream_unavailable: 502,
  content_filtered: 422,
  invalid_output: 502,
  unsupported_capability: 501,
  document_encrypted: 422,
  document_no_text: 422,
  unsupported_file_type: 415,
  unknown: 500,
};

// Every message is static and Vietnamese — upstream error text (which can contain
// project ids, quota details, model names) never reaches the client. See
// docs/api_document.md §0.
const MESSAGE_VI: Record<ProblemCode, string> = {
  bad_request: 'Yêu cầu không hợp lệ.',
  invalid_input: 'Dữ liệu gửi lên không đúng định dạng.',
  forbidden_origin: 'Yêu cầu bị từ chối.',
  payload_too_large: 'Nội dung gửi lên quá lớn.',
  rate_limited: 'Bạn thao tác hơi nhanh. Đợi một chút rồi thử lại.',
  auth: 'Máy chủ cấu hình sai. Vui lòng báo cho quản trị viên.',
  login_required: 'Tính năng này cần đăng nhập. Tạo tài khoản hoặc đăng nhập rồi thử lại.',
  gmail_not_connected: 'Vui lòng kết nối tài khoản Gmail trong Cài đặt.',
  quota_exhausted: 'Đã hết hạn mức sử dụng AI hôm nay.',
  timeout: 'Yêu cầu mất quá nhiều thời gian. Thử lại nhé.',
  aborted: 'Yêu cầu đã bị huỷ.',
  upstream_unavailable: 'Dịch vụ AI tạm thời không phản hồi. Thử lại sau.',
  content_filtered: 'Nội dung bị từ chối bởi bộ lọc an toàn.',
  invalid_output: 'AI trả về kết quả không hợp lệ. Thử lại nhé.',
  unsupported_capability: 'Tính năng này chưa khả dụng với cấu hình hiện tại.',
  document_encrypted: 'Tệp này được đặt mật khẩu. Gỡ mật khẩu rồi thử lại, hoặc dán trực tiếp văn bản.',
  document_no_text: 'Tệp này là ảnh scan, không có lớp văn bản để đọc. Thử tệp khác hoặc dán trực tiếp văn bản.',
  unsupported_file_type: 'Định dạng tệp này chưa được hỗ trợ. Dùng .txt, .md, .pdf hoặc .docx.',
  unknown: 'Đã có lỗi xảy ra. Thử lại sau.',
};

export interface ProblemBody {
  error: { code: ProblemCode; message: string; requestId: string };
}

export function problemResponse(code: ProblemCode, requestId: string, extraHeaders?: Record<string, string>): Response {
  const body: ProblemBody = { error: { code, message: MESSAGE_VI[code], requestId } };
  return new Response(JSON.stringify(body), {
    status: STATUS[code],
    headers: { 'content-type': 'application/json', 'x-request-id': requestId, ...extraHeaders },
  });
}
