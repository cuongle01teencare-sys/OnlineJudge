import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable, Logger } from '@nestjs/common';
import { isAboutFileIo, type TestCaseSuggestionsDto } from '@oj/contracts';
import { z } from 'zod';
import { ClaudeClient } from '../../../shared/infrastructure/claude.js';
import { TestCaseSuggester, type TestSuggestionContext } from '../application/ports.js';

const SuggestionsSchema = z.object({
  tests: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
      purpose: z.string(),
      outputVerified: z.boolean(),
    }),
  ),
  notes: z.array(z.string()),
});

const SYSTEM = `Bạn giúp giáo viên tin học viết thêm test cho một bài lập trình (đề thường bằng tiếng Việt).
Cách làm:
1. Đọc kỹ đề, định dạng vào/ra và ràng buộc. Chọn các test bổ sung cho bộ test hiện có: trường hợp biên (giá trị nhỏ nhất/lớn nhất trong khả năng, n = 1, toàn số bằng nhau, số âm, kết quả 0...), trường hợp đặc biệt dễ sai, và vài test ngẫu nhiên vừa phải. Không lặp lại test đã có.
2. LUÔN tính output bằng cách CHẠY CODE trong công cụ code execution trước khi trả lời, kể cả với bài rất đơn giản (giáo viên cần biết output đã được chạy thử): viết lời giải bằng Python (nếu có lời giải mẫu thì dựa theo nó, hoặc chạy chính nó nếu môi trường có trình biên dịch), kiểm tra lời giải với các test đã có, rồi chạy trên từng input mới. Với bài nhỏ, nên viết thêm một lời giải vét cạn để đối chiếu.
   outputVerified = true chỉ khi output được lấy từ kết quả chạy code VÀ lời giải đó cho đúng các test đã có (nếu có). Nếu phải tự tính tay thì đặt false.
3. Mỗi input phải đúng định dạng đề và thỏa ràng buộc. Giữ test gọn: mỗi input tối đa khoảng 2000 ký tự. Nếu cần test rất lớn (ví dụ n = 10^5) thì không đưa vào, chỉ ghi vào notes để giáo viên tự sinh bằng chương trình.
4. Hệ thống chấm đưa input vào đầu vào chuẩn và so sánh đầu ra chuẩn, không dùng file (kể cả khi đề nhắc tới file .INP/.OUT).
   input và expectedOutput giữ nguyên từng dòng, mỗi chuỗi kết thúc bằng một ký tự xuống dòng.
5. purpose: một câu ngắn bằng tiếng Việt nói test kiểm tra điều gì.
6. notes: những điều giáo viên nên xem lại (đề mơ hồ, có nhiều đáp án đúng nên cần checker riêng, lời giải mẫu có vẻ sai với test đã có...), bằng tiếng Việt, ngắn gọn. Không ghi chú về đọc/ghi file. Có thể để trống.`;

const MAX_ROUNDS = 4;
const SHOWN_TEST_CHARS = 1500;

/** Claude proposes tests and computes their outputs by running code in Anthropic's sandbox. */
@Injectable()
export class ClaudeTestCaseSuggester extends TestCaseSuggester {
  private readonly logger = new Logger(ClaudeTestCaseSuggester.name);

  constructor(private readonly claude: ClaudeClient) {
    super();
  }

  get available(): boolean {
    return this.claude.enabled;
  }

  async suggest(context: TestSuggestionContext): Promise<TestCaseSuggestionsDto> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt(context) }];
    let parsed: z.infer<typeof SuggestionsSchema> | null = null;
    // Whether the model actually used the sandbox: without it no output counts as verified, whatever it claims.
    let ranCode = false;

    // Server-side tools may pause a long turn; resend it unchanged to let the server continue.
    // Streamed: the SDK refuses a non-streaming request this large (it could outlast the HTTP timeout).
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await this.claude.api!.beta.messages
        .stream({
          ...ClaudeClient.target(this.claude.models.testCases),
          max_tokens: 32000,
          system: SYSTEM,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium', format: betaZodOutputFormat(SuggestionsSchema) },
          tools: [{ type: 'code_execution_20260120', name: 'code_execution' }],
          messages,
        })
        .finalMessage();
      ranCode ||= response.content.some((b) => b.type === 'server_tool_use');
      if (response.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
        continue;
      }
      if (response.stop_reason === 'refusal') throw new Error('Claude declined to write tests for this problem');
      if (response.stop_reason === 'max_tokens') throw new Error('Test suggestions too long');
      parsed = response.parsed_output;
      break;
    }
    if (!parsed) throw new Error('AI returned no test suggestions');
    this.logger.log(`AI suggested ${parsed.tests.length} tests for "${context.title}" (${ranCode ? 'ran code' : 'did not run code'})`);

    return {
      suggestions: parsed.tests
        .filter((t) => t.input.trim() && t.expectedOutput.trim())
        .slice(0, context.count)
        .map((t) => ({
          input: withNewline(t.input),
          expectedOutput: withNewline(t.expectedOutput),
          purpose: t.purpose.trim(),
          outputVerified: t.outputVerified && ranCode,
        })),
      // The judge never uses files, so hints about them only confuse the teacher.
      notes: parsed.notes.map((n) => n.trim()).filter((n) => n && !isAboutFileIo(n)),
    };
  }
}

function prompt(c: TestSuggestionContext): string {
  const section = (title: string, body: string) => (body.trim() ? `## ${title}\n${body.trim()}\n\n` : '');
  const tests = c.existingTests.length
    ? c.existingTests
        .map((t, i) => `### Test ${i + 1}\nInput:\n\`\`\`\n${clip(t.input)}\n\`\`\`\nOutput:\n\`\`\`\n${clip(t.expectedOutput)}\n\`\`\``)
        .join('\n')
    : '(chưa có test nào)';
  const solution = c.solution
    ? section('Lời giải mẫu của giáo viên', [
        c.solution.explanation,
        c.solution.code.trim() ? `\`\`\`${c.solution.language ?? ''}\n${c.solution.code}\n\`\`\`` : '',
      ].filter(Boolean).join('\n\n'))
    : '';
  return (
    `# ${c.title}\n\n` +
    section('Đề bài', c.statement) +
    section('Dữ liệu vào', c.inputFormat) +
    section('Dữ liệu ra', c.outputFormat) +
    section('Ràng buộc', c.constraints) +
    `Giới hạn: ${c.timeLimitMs} ms, ${c.memoryLimitMb} MB.\n\n` +
    `## Các test hiện có\n${tests}\n\n` +
    solution +
    `Hãy gợi ý ${c.count} test mới.` +
    (c.focus ? ` Giáo viên muốn tập trung vào: ${c.focus}` : '')
  );
}

const clip = (s: string) => (s.length > SHOWN_TEST_CHARS ? `${s.slice(0, SHOWN_TEST_CHARS)}\n… (đã cắt bớt)` : s.replace(/\n$/, ''));
const withNewline = (s: string) => (s.endsWith('\n') ? s : `${s}\n`);
