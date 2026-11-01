import { Injectable } from '@nestjs/common';
import { MailTransport } from '../../../shared/application/mail-transport.js';
import { IdentityMailer } from '../application/ports.js';

const timeFmt = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
});

@Injectable()
export class EmailIdentityMailer extends IdentityMailer {
  constructor(private readonly transport: MailTransport) {
    super();
  }

  sendRegistrationCode(to: string, name: string, code: string, expiresAt: Date) {
    return this.transport.send({
      to,
      subject: `${code} là mã xác thực tài khoản Online Judge`,
      text: `Chào ${name},\n\nMã xác thực của bạn là: ${code}\nMã có hiệu lực đến ${timeFmt.format(expiresAt)}.\n\nNếu bạn không đăng ký, hãy bỏ qua email này.`,
      html: layout(`<p>Chào ${esc(name)},</p>
        <p>Nhập mã dưới đây để hoàn tất đăng ký tài khoản học sinh:</p>
        ${codeBlock(code)}
        <p style="color:#555">Mã có hiệu lực đến ${timeFmt.format(expiresAt)}. Nếu bạn không đăng ký, hãy bỏ qua email này.</p>`),
    });
  }

  sendPasswordResetCode(to: string, name: string, code: string, expiresAt: Date) {
    return this.transport.send({
      to,
      subject: `${code} là mã đặt lại mật khẩu Online Judge`,
      text: `Chào ${name},\n\nMã đặt lại mật khẩu: ${code}\nMã có hiệu lực đến ${timeFmt.format(expiresAt)}.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn vẫn giữ nguyên.`,
      html: layout(`<p>Chào ${esc(name)},</p>
        <p>Nhập mã dưới đây để đặt mật khẩu mới:</p>
        ${codeBlock(code)}
        <p style="color:#555">Mã có hiệu lực đến ${timeFmt.format(expiresAt)}. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu vẫn giữ nguyên.</p>`),
    });
  }

  sendTeacherInvitation(to: string, name: string, acceptUrl: string, code: string, expiresAt: Date) {
    return this.transport.send({
      to,
      subject: 'Lời mời tham gia Online Judge với vai trò giáo viên',
      text: `Chào ${name},\n\nBạn được mời tham gia Online Judge với vai trò giáo viên.\nMở liên kết sau để đặt mật khẩu và kích hoạt tài khoản:\n${acceptUrl}\n\nMã xác thực: ${code}\nLời mời có hiệu lực đến ${timeFmt.format(expiresAt)}.`,
      html: layout(`<p>Chào ${esc(name)},</p>
        <p>Bạn được mời tham gia Online Judge với vai trò <b>giáo viên</b>. Bấm nút dưới đây để đặt mật khẩu và kích hoạt tài khoản.</p>
        <p style="margin:24px 0"><a href="${esc(acceptUrl)}" style="background:#4A2FA0;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">Kích hoạt tài khoản</a></p>
        <p>Nếu được hỏi mã xác thực, hãy nhập:</p>
        ${codeBlock(code)}
        <p style="color:#555">Lời mời có hiệu lực đến ${timeFmt.format(expiresAt)}.</p>`),
    });
  }
}

function codeBlock(code: string) {
  return `<p style="font:700 28px/1.2 'Courier New',monospace;letter-spacing:6px;color:#4A2FA0;margin:16px 0">${code}</p>`;
}

function layout(body: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#232838;max-width:520px">
    <p style="font-weight:700;color:#4A2FA0">Online Judge</p>${body}</div>`;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
