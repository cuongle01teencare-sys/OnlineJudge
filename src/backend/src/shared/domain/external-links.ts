/**
 * Imported exams often carry links to other places: the original problem on another judge
 * ("Link problem : https://leetcode.com/..."), group invitations (Zalo, Facebook, Telegram, Discord),
 * short links. None of it belongs in a statement students read, so links are removed, and a line that
 * was only there to carry a link ("Link problem :", "Tham gia nhóm Zalo: ...") goes with it.
 */

// A closing parenthesis ends a link: "(https://...)" in a sentence leaves "()" behind, which is then dropped.
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"'`)]+|\b(?:t\.me|zalo\.me|discord\.gg|discord\.com\/invite|fb\.com|fb\.me|m\.me|facebook\.com|bit\.ly|tinyurl\.com|forms\.gle)\/[^\s<>"'`)]*/gi;
const MARKDOWN_LINK = /!?\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
const AUTOLINK = /<(?:https?:\/\/|www\.)[^>]+>/gi;
// \b does not know Vietnamese letters, so words are bounded by "not a letter or digit".
const word = (alternatives: string, flags = 'giu') => new RegExp(`(?<![\\p{L}\\d])(?:${alternatives})(?![\\p{L}\\d])`, flags);
/** Words of a line whose only job was to point somewhere else. */
const LINK_LABEL = word('link|links|url|nguồn|source|tham khảo|xem thêm|đề gốc|problem|bài gốc|website|web|tại|ở|đây|here');
/** A line with a link and one of these is an invitation to another channel: it goes entirely. */
const INVITATION = word(
  'tham gia|join|vào nhóm|nhóm|group|zalo|facebook|fb|fanpage|telegram|discord|kênh|channel|inbox|liên hệ|đăng ký|subscribe',
  'iu',
);
const isUrl = (s: string) => new RegExp(URL.source, 'i').test(s);

const trimUrl = (url: string) => url.replace(/[.,;:!?)\]]+$/, '');
const hostOf = (url: string) => {
  try {
    return new globalThis.URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Removes external links from a section; returns the hosts that were removed (for a warning). */
export function stripExternalLinks(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const note = (url: string) => removed.push(hostOf(trimUrl(url)));

  const lines = text.split('\n').flatMap((line) => {
    let hadLink = false;
    let out = line
      // [text](url): keep the words unless they are the link itself
      .replace(MARKDOWN_LINK, (_, label: string, url: string) => {
        hadLink = true;
        note(url);
        return isUrl(label) ? '' : label;
      })
      .replace(AUTOLINK, (m) => {
        hadLink = true;
        note(m.slice(1, -1));
        return '';
      })
      .replace(URL, (m) => {
        hadLink = true;
        note(m);
        return '';
      });
    URL.lastIndex = 0;
    if (!hadLink) return [line];
    if (INVITATION.test(line)) return [];
    out = out.replace(/[ \t]*\([ \t]*\)/g, '').replace(/[ \t]+([:.,;])/g, '$1').replace(/[ \t]{2,}/g, ' ').trimEnd();
    // What is left once the label words are gone: nothing worth keeping means the line only carried the link.
    const rest = out.replace(LINK_LABEL, '').replace(/[\s:.,;\-–—*_#>()[\]|!?"']+/g, '');
    return rest.length <= 2 ? [] : [out];
  });

  return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), removed: [...new Set(removed)] };
}
