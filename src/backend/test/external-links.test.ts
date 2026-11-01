import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stripExternalLinks } from '../src/shared/domain/external-links.js';

const strip = (s: string) => stripExternalLinks(s).text;

test('a line that only points to another site goes entirely', () => {
  const r = stripExternalLinks('Cho mảng gồm n số nguyên dương.\nLink problem : https://leetcode.com/problems/minimum-size-subarray-sum/    \nTìm đoạn con ngắn nhất.');
  assert.equal(r.text, 'Cho mảng gồm n số nguyên dương.\nTìm đoạn con ngắn nhất.');
  assert.deepEqual(r.removed, ['leetcode.com']);
  assert.equal(strip('Nguồn: https://codeforces.com/problemset/problem/4/A'), '');
  assert.equal(strip('Xem thêm tại www.spoj.com/problems/TEST.'), '');
  assert.equal(strip('[Đề gốc](https://vnoi.info/problems/ABC)'), '');
  assert.equal(strip('<https://oj.vnoi.info/problem/abc>'), '');
});

test('invitations to groups and channels go with their line', () => {
  assert.equal(strip('Tham gia nhóm Zalo để nhận thêm đề: https://zalo.me/g/abcdef\nCho n.'), 'Cho n.');
  assert.equal(strip('Join Discord: discord.gg/abc123'), '');
  assert.equal(strip('Fanpage: facebook.com/tinhoc.thpt'), '');
  assert.equal(strip('Đăng ký kênh t.me/onthi_hsg nhé!'), '');
});

test('a link inside a real sentence is removed and the sentence kept', () => {
  assert.equal(strip('Dãy Fibonacci (https://vi.wikipedia.org/wiki/Fibonacci) được định nghĩa như sau:'), 'Dãy Fibonacci được định nghĩa như sau:');
  assert.equal(strip('Cho [dãy Fibonacci](https://vi.wikipedia.org/wiki/Fibonacci) gồm n số.'), 'Cho dãy Fibonacci gồm n số.');
});

test('text without links is untouched', () => {
  const s = 'Cho n số nguyên. In ra tổng.\nRàng buộc: 1 ≤ n ≤ 10^5, a.b là số thực.\nNhóm các số chẵn lại.';
  assert.deepEqual(stripExternalLinks(s), { text: s, removed: [] });
});
