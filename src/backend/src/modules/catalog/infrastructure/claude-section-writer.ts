import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable } from '@nestjs/common';
import { isAboutFileIo, ProblemTextFieldLabels, type ProblemDraftContent } from '@oj/contracts';
import { z } from 'zod';
import { ClaudeClient } from '../../../shared/infrastructure/claude.js';
import { ProblemSectionWriter, type TextSection } from '../application/ports.js';

const SectionSchema = z.object({ text: z.string(), notes: z.array(z.string()) });

const SYSTEM = `Bạn giúp giáo viên tin học viết lại MỘT mục của đề bài lập trình (tiếng Việt), dựa trên toàn bộ đề hiện có.
Quy tắc chung:
- Giữ đúng ý nghĩa, số liệu và giới hạn của đề; không bịa thêm yêu cầu mới. Thiếu thông tin thì giữ nguyên chỗ đó và ghi vào notes.
- Viết bằng Markdown, công thức và giới hạn dạng LaTeX $...$ (ví dụ $1 \\le n \\le 10^6$).
- Hệ thống chấm chỉ dùng đầu vào chuẩn (bàn phím) và đầu ra chuẩn (màn hình), không dùng file: không nhắc tới tên file, .INP/.OUT hay "tên file chương trình".
- text chỉ chứa nội dung của mục được yêu cầu, không lặp tiêu đề mục.
Theo từng mục:
- Đề bài (statement): kể lại yêu cầu rõ ràng, mạch lạc; giữ câu chuyện của đề; không chép phần dữ liệu vào, kết quả, ràng buộc, ví dụ.
- Dữ liệu vào (inputFormat): mô tả từng dòng của đầu vào (dòng 1 gồm..., dòng 2 gồm...), kiểu và ý nghĩa từng giá trị.
- Kết quả (outputFormat): mô tả chính xác những gì cần in ra màn hình, theo từng dòng.
- Ràng buộc (constraints): gom mọi giới hạn có trong đề (kể cả nằm rải rác trong đề bài, dữ liệu vào) thành danh sách gạch đầu dòng. Nếu đề có các subtask/nhóm test thì liệt kê từng nhóm.
notes: những điều giáo viên nên kiểm tra lại, tiếng Việt, ngắn gọn; có thể để trống.`;

/** Claude rewrites one text section of a (possibly unsaved) problem. */
@Injectable()
export class ClaudeSectionWriter extends ProblemSectionWriter {
  constructor(private readonly claude: ClaudeClient) {
    super();
  }

  get available(): boolean {
    return this.claude.enabled;
  }

  async write(section: TextSection, p: ProblemDraftContent): Promise<{ text: string; notes: string[] }> {
    const part = (title: string, body: string) => `## ${title}\n${body.trim() || '(trống)'}\n\n`;
    const samples = (p.samples ?? [])
      .map((s, i) => `### Ví dụ ${i + 1}\nInput:\n\`\`\`\n${s.input.trimEnd()}\n\`\`\`\nOutput:\n\`\`\`\n${s.expectedOutput.trimEnd()}\n\`\`\``)
      .join('\n');
    const prompt =
      `# ${p.title || '(chưa đặt tên)'}\n\n` +
      part('Đề bài', p.statement) +
      part('Dữ liệu vào', p.inputFormat) +
      part('Kết quả', p.outputFormat) +
      part('Ràng buộc', p.constraints) +
      (samples ? `## Ví dụ\n${samples}\n\n` : '') +
      `Hãy viết lại mục "${ProblemTextFieldLabels[section]}" (${section}).`;

    const response = await this.claude.api!.beta.messages.parse({
      ...ClaudeClient.target(this.claude.models.examReader),
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: 'low', format: betaZodOutputFormat(SectionSchema) },
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to rewrite this section');
    if (response.stop_reason === 'max_tokens') throw new Error('Section rewrite too long');
    const parsed = response.parsed_output;
    if (!parsed) throw new Error('AI returned no text');
    return { text: parsed.text.trim(), notes: parsed.notes.map((n) => n.trim()).filter((n) => n && !isAboutFileIo(n)) };
  }
}
