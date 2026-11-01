"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const save_path = path.join(
  __dirname,
  "..",
  "userscripts",
  "save-obsidian",
  "linux.do 帖子保存到 Obsidian.user.js",
);
const reader_path = path.join(
  __dirname,
  "..",
  "userscripts",
  "topic-reader",
  "linux.do 帖子弹框阅读.user.js",
);

// 先把 CSS 里的 ${CONSTANT} 占位符折叠成 X，避免占位符内的花括号干扰规则切分。
function normalize(source) {
  return source.replace(/\$\{[A-Z_]+\}/g, "X");
}

const save_source = normalize(fs.readFileSync(save_path, "utf8"));
const reader_source = normalize(fs.readFileSync(reader_path, "utf8"));

// 取出选择器所在 CSS 规则的声明块，返回其中第一个 z-index 数值。
function block_z_index(source, selector) {
  let start = source.indexOf(selector + "{");
  if (start === -1) {
    // 选择器位于规则选择器列表中间时，向后找这条规则的左花括号。
    const selector_at = source.indexOf(selector);
    assert.notEqual(selector_at, -1, `找不到选择器 ${selector}`);
    start = source.indexOf("{", selector_at);
  }
  assert.notEqual(start, -1, `找不到选择器 ${selector}`);
  const close = source.indexOf("}", start);
  assert.ok(close > start, `${selector} 不是完整 CSS 规则`);
  const block = source.slice(start, close);
  const matched = block.match(/z-index:\s*(\d+)/);
  assert.ok(matched, `${selector} 没有声明 z-index`);
  return Number(matched[1]);
}

const reader_backdrop_z = block_z_index(
  reader_source,
  "#ldo-topic-reader-backdrop",
);
const reader_chrome_z = block_z_index(reader_source, "#X.reader-dialog-shell");
const reader_native_overlay_z = block_z_index(
  reader_source,
  "body.X .composer-container",
);
const actions_z = block_z_index(save_source, "#ldo-obsidian-actions ");
const modal_z = block_z_index(save_source, "#ldo-obsidian-modal ");
const toast_z = block_z_index(save_source, "#ldo-obsidian-toast ");

test("阅读弹框遮罩低于弹框外壳", () => {
  assert.ok(reader_backdrop_z < reader_chrome_z);
});

test("保存按钮组始终显示在阅读弹框之上", () => {
  assert.ok(
    actions_z > reader_chrome_z,
    `保存按钮组 z-index ${actions_z} 必须高于阅读弹框 ${reader_chrome_z}，否则弹框打开后按钮不可见、不可点击`,
  );
});

test("保存设置弹窗与提示覆盖阅读弹框及其内部原生浮层", () => {
  assert.ok(modal_z > reader_chrome_z);
  assert.ok(toast_z > modal_z);
  assert.ok(
    toast_z > reader_native_overlay_z,
    `保存提示 z-index ${toast_z} 必须高于阅读模式下的原生浮层 ${reader_native_overlay_z}`,
  );
});

test("保存脚本不再使用会被弹框遮住的低层级数值", () => {
  assert.doesNotMatch(save_source, /z-index:\s*9999/);
  assert.doesNotMatch(save_source, /z-index:\s*10000/);
  assert.doesNotMatch(save_source, /z-index:\s*10001/);
});
