import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable } from '@nestjs/common';
import { LanguageLabels, type Language } from '@oj/contracts';
import { z } from 'zod';
import { ClaudeClient } from '../../../shared/infrastructure/claude.js';
import { AiUsageReviewer, type AiReview } from '../application/ports.js';

const ReviewSchema = z.object({
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  summary: z.string(),
  reasons: z.array(z.string()),
  segments: z.array(z.object({ startLine: z.number(), endLine: z.number(), reason: z.string() })),
});

const SYSTEM = `Bạn hỗ trợ giáo viên tin học xem lại bài nộp của học sinh phổ thông.
Nhiệm vụ: ước lượng khả năng đoạn code được viết bằng trợ lý AI thay vì học sinh tự viết.
Đây chỉ là gợi ý để giáo viên tự xem lại, không phải kết luận. Kết luận sai sẽ ảnh hưởng nặng tới học sinh, nên:
- Mặc định là LOW. Chỉ chọn MEDIUM khi có nhiều dấu hiệu cụ thể cùng lúc, HIGH khi dấu hiệu rất rõ.
- Code ngắn, đúng, gọn gàng KHÔNG phải là dấu hiệu dùng AI: bài dễ thường có lời giải giống nhau.
- Dấu hiệu đáng kể: chú thích giải thích từng dòng kiểu hướng dẫn, docstring/type hint hoặc xử lý lỗi thừa so với đề,
  dùng kỹ thuật vượt xa yêu cầu của đề, phong cách không nhất quán giữa các phần, tên biến kiểu tiếng Anh chuẩn mực
  lẫn với phần còn lại, văn bản thừa còn sót lại từ câu trả lời của chatbot.
summary: một câu ngắn bằng tiếng Việt. reasons: các dấu hiệu cụ thể bằng tiếng Việt.
segments: các khoảng dòng (đánh số từ 1, theo số dòng đã cho) đáng xem lại, kèm lý do ngắn; để trống nếu risk là LOW.`;

/** Asks Claude for a cautious estimate of AI-written code; numbered lines let it point at segments. */
@Injectable()
export class ClaudeAiUsageReviewer extends AiUsageReviewer {
  constructor(private readonly claude: ClaudeClient) {
    super();
  }

  get available(): boolean {
    return this.claude.enabled;
  }

  async review(input: { statement: string; language: Language; code: string }): Promise<AiReview> {
    const lines = input.code.split('\n');
    const numbered = lines.map((line, i) => `${String(i + 1).padStart(3, ' ')} | ${line}`).join('\n');
    const response = await this.claude.api!.beta.messages.parse({
      ...ClaudeClient.target(this.claude.models.aiUsageReview),
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: betaZodOutputFormat(ReviewSchema) },
      messages: [{
        role: 'user',
        content: `Đề bài:\n${input.statement}\n\nBài nộp (${LanguageLabels[input.language]}), mỗi dòng có số thứ tự:\n${numbered}`,
      }],
    });
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to review this submission');
    const parsed = response.parsed_output;
    if (!parsed) throw new Error('AI review returned no result');
    const clampLine = (n: number) => Math.min(lines.length, Math.max(1, Math.round(n)));
    return {
      ...parsed,
      segments: parsed.risk === 'LOW' ? [] : parsed.segments.map((s) => ({
        startLine: clampLine(s.startLine),
        endLine: Math.max(clampLine(s.startLine), clampLine(s.endLine)),
        reason: s.reason,
      })),
    };
  }
}
