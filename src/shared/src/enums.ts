export const Roles = ['ADMIN', 'TEACHER', 'STUDENT'] as const;
export type Role = (typeof Roles)[number];

export const Difficulties = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;
export type Difficulty = (typeof Difficulties)[number];

export const DifficultyLabels: Record<Difficulty, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
  EXPERT: 'Rất khó',
};

export const Languages = ['cpp', 'c', 'python', 'java', 'javascript'] as const;
export type Language = (typeof Languages)[number];

export const LanguageLabels: Record<Language, string> = {
  cpp: 'C++17',
  c: 'C11',
  python: 'Python 3',
  java: 'Java 17',
  javascript: 'JavaScript (Node.js)',
};

export const Verdicts = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'IE'] as const;
export type Verdict = (typeof Verdicts)[number];

export const VerdictLabels: Record<Verdict, string> = {
  AC: 'Chấp nhận',
  WA: 'Sai kết quả',
  TLE: 'Quá thời gian',
  MLE: 'Quá bộ nhớ',
  RE: 'Lỗi khi chạy',
  CE: 'Lỗi biên dịch',
  IE: 'Lỗi hệ thống',
};

export const SubmissionStatuses = ['PENDING', 'JUDGING', 'DONE'] as const;
export type SubmissionStatus = (typeof SubmissionStatuses)[number];

export const ProblemSetTypes = ['EXAM', 'TEST', 'HOMEWORK', 'PRACTICE'] as const;
export type ProblemSetType = (typeof ProblemSetTypes)[number];

export const ProblemSetTypeLabels: Record<ProblemSetType, string> = {
  EXAM: 'Đề thi',
  TEST: 'Đề kiểm tra',
  HOMEWORK: 'Bài tập về nhà',
  PRACTICE: 'Luyện tập',
};
