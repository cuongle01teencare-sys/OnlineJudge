/**
 * Word equations (Office Math, <m:oMath>) are dropped by mammoth, so "n ≤ 10^5" would read as "n ≤".
 * Before conversion each equation is replaced by a plain text run: 10^5, a_i, 10^{18}, (a+b)/2, sqrt(n).
 */

interface Node {
  name: string;
  attrs: string;
  children: Node[];
  text: string;
}

const EQUATION = /<m:oMathPara\b[^>]*>[\s\S]*?<\/m:oMathPara>|<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g;

/** Replaces every equation in a document.xml with a text run holding its plain-text form. */
export function inlineEquations(documentXml: string): string {
  return documentXml.replace(EQUATION, (equation) => {
    const text = render(parse(equation)).trim();
    return text ? `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>` : '';
  });
}

function parse(xml: string): Node {
  const root: Node = { name: '', attrs: '', children: [], text: '' };
  const stack = [root];
  for (const token of xml.match(/<[^>]+>|[^<]+/g) ?? []) {
    const parent = stack[stack.length - 1];
    if (!token.startsWith('<')) {
      parent.text += token;
      continue;
    }
    if (token.startsWith('<?') || token.startsWith('<!')) continue;
    const name = /^<\/?\s*([\w:]+)/.exec(token)?.[1] ?? '';
    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const node: Node = { name, attrs: token, children: [], text: '' };
    parent.children.push(node);
    if (!token.endsWith('/>')) stack.push(node);
  }
  return root;
}

const child = (node: Node, name: string) => node.children.find((c) => c.name === name);
const all = (node: Node | undefined) => (node ? node.children.map(render).join('') : '');
/** The m:val of a property such as <m:chr m:val="∑"/>, already XML-escaped. */
const prop = (node: Node, props: string, name: string) =>
  /m:val="([^"]*)"/.exec(child(child(node, props) ?? node, name)?.attrs ?? '')?.[1];

/** One character stays bare (10^6); longer groups get braces (10^{18}). */
const group = (s: string) => (s.length <= 1 || /^&[#\w]+;$/.test(s) ? s : `{${s}}`);
const paren = (s: string) => (/^[\p{L}\d.]+$/u.test(s) ? s : `(${s})`);

function render(node: Node): string {
  switch (node.name) {
    case 'm:t':
    case 'w:t':
      return node.text;
    case 'm:sSup':
      return all(child(node, 'm:e')) + '^' + group(all(child(node, 'm:sup')));
    case 'm:sSub':
      return all(child(node, 'm:e')) + '_' + group(all(child(node, 'm:sub')));
    case 'm:sSubSup':
      return all(child(node, 'm:e')) + '_' + group(all(child(node, 'm:sub'))) + '^' + group(all(child(node, 'm:sup')));
    case 'm:f':
      return `${paren(all(child(node, 'm:num')))}/${paren(all(child(node, 'm:den')))}`;
    case 'm:rad': {
      const degree = all(child(node, 'm:deg'));
      return `${degree ? `root${degree}` : 'sqrt'}(${all(child(node, 'm:e'))})`;
    }
    case 'm:d': {
      const open = prop(node, 'm:dPr', 'm:begChr') ?? '(';
      const close = prop(node, 'm:dPr', 'm:endChr') ?? ')';
      const separator = prop(node, 'm:dPr', 'm:sepChr') ?? ',';
      return open + node.children.filter((c) => c.name === 'm:e').map(render).join(separator) + close;
    }
    case 'm:nary': {
      const symbol = prop(node, 'm:naryPr', 'm:chr') ?? '∫';
      const sub = all(child(node, 'm:sub'));
      const sup = all(child(node, 'm:sup'));
      return symbol + (sub ? `_${group(sub)}` : '') + (sup ? `^${group(sup)}` : '') + ' ' + all(child(node, 'm:e'));
    }
    default:
      // Property elements (m:rPr, m:sSupPr, w:rPr...) carry formatting only.
      if (node.name.endsWith('Pr')) return '';
      return node.text + node.children.map(render).join('');
  }
}
