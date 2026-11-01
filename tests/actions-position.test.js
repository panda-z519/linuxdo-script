"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const script_path = path.join(
  __dirname,
  "..",
  "userscripts",
  "save-obsidian",
  "linux.do 帖子保存到 Obsidian.user.js",
);
const { clamp_actions_position } = require(script_path);
const source = fs.readFileSync(script_path, "utf8");

const group = { width: 150, height: 60 };

test("越界的位置被夹回视口内", () => {
  // 0.9.6 在按钮隐藏（0×0）时算位置，把按钮组摆到视口右下角之外。
  assert.deepEqual(
    clamp_actions_position(2660, 1536, group, { width: 2672, height: 1548 }),
    { left: 2510, top: 1476 },
  );
});

test("未越界的拖动位置原样保留", () => {
  assert.deepEqual(
    clamp_actions_position(800, 600, group, { width: 1440, height: 900 }),
    { left: 800, top: 600 },
  );
});

test("视口小于按钮组时仍留出边距", () => {
  assert.deepEqual(
    clamp_actions_position(-500, -500, group, { width: 100, height: 80 }),
    { left: 12, top: 12 },
  );
});

test("隐藏状态下测量真实尺寸，并在显示与缩放时重新夹紧", () => {
  assert.match(source, /function measure_actions\(actions\)/);
  assert.match(
    source,
    /actions\.hidden = false;\s*actions\.style\.visibility = "hidden";/,
  );
  assert.match(source, /function keep_actions_position_in_view\(actions\)/);
  assert.match(
    source,
    /if \(should_show\) \{[\s\S]{0,120}keep_actions_position_in_view\(actions\);/,
  );
  assert.match(
    source,
    /window\.addEventListener\("resize",[\s\S]{0,160}keep_actions_position_in_view\(actions\);/,
  );
});
