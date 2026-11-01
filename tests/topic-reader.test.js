"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const script_path = path.join(
  __dirname,
  "..",
  "userscripts",
  "topic-reader",
  "linux.do 帖子弹框阅读.user.js",
);
const reader = require(script_path);

test("识别 linux.do 主题链接并保留主题 ID", () => {
  assert.deepEqual(
    reader.parse_topic_url("https://linux.do/t/123", "https://linux.do/latest"),
    {
      topic_id: "123",
      url: "https://linux.do/t/123",
    },
  );
  assert.deepEqual(
    reader.parse_topic_url(
      "https://linux.do/t/topic-title/123/45",
      "https://linux.do/latest",
    ),
    {
      topic_id: "123",
      url: "https://linux.do/t/topic-title/123/45",
    },
  );
});

test("拒绝非主题页和跨站链接", () => {
  assert.equal(
    reader.parse_topic_url(
      "https://linux.do/latest",
      "https://linux.do/latest",
    ),
    null,
  );
  assert.equal(
    reader.parse_topic_url(
      "https://example.com/t/topic/123",
      "https://linux.do/latest",
    ),
    null,
  );
});

test("仅拦截普通左键点击", () => {
  assert.equal(reader.should_intercept_click({ button: 0 }), true);
  assert.equal(reader.should_intercept_click({ button: 1 }), false);
  assert.equal(
    reader.should_intercept_click({ button: 0, metaKey: true }),
    false,
  );
  assert.equal(
    reader.should_intercept_click({ button: 0, ctrlKey: true }),
    false,
  );
  assert.equal(
    reader.should_intercept_click({ button: 0, shiftKey: true }),
    false,
  );
  assert.equal(
    reader.should_intercept_click({ button: 0, altKey: true }),
    false,
  );
});

test("仅允许指定协议", () => {
  const page_url = "https://linux.do/latest";
  assert.equal(
    reader.get_safe_url("/t/topic/123", page_url, ["https:"]),
    "https://linux.do/t/topic/123",
  );
  assert.equal(
    reader.get_safe_url("javascript:alert(1)", page_url, ["https:"]),
    null,
  );
  assert.equal(
    reader.get_safe_url("data:text/html,test", page_url, ["https:"]),
    null,
  );
});

test("根据弹框宽度统一计算原生帖子正文宽度", () => {
  assert.equal(reader.calculate_topic_body_width(1480), 1251);
  assert.equal(reader.calculate_topic_body_width(900), 671);
  assert.equal(reader.calculate_topic_body_width(600), 371);
  assert.equal(reader.calculate_topic_body_width(300), 320);
});

test("阅读模式保留来源页并复用原生主题路由", () => {
  assert.deepEqual(
    reader.build_reader_state(
      "https://linux.do/t/topic-title/123/45",
      "https://linux.do/latest",
    ),
    {
      source_url: "https://linux.do/latest",
      topic_url: "https://linux.do/t/topic-title/123",
    },
  );
  assert.equal(
    reader.build_reader_state(
      "https://example.com/t/topic-title/123",
      "https://linux.do/latest",
    ),
    null,
  );
});

test("Safari Userscripts 元数据和语法兼容边界固定", () => {
  const source = fs.readFileSync(script_path, "utf8");
  assert.match(source, /@inject-into\s+content/);
  assert.doesNotMatch(source, /\?\./);
  assert.doesNotMatch(source, /\?\?/);
  assert.doesNotMatch(source, /\.replaceAll\s*\(/);
  assert.match(source, /ldo-topic-reader-active/);
  assert.match(source, /\.sidebar-wrapper/);
  assert.match(source, /history\.back\(\)/);
  assert.match(source, /reader-dialog-shell/);
  assert.match(source, /appendChild\(main_outlet\)/);
  assert.match(source, /insertBefore\(main_outlet/);
  assert.match(source, /min\(1480px,calc\(100vw - 32px\)\)/);
  assert.match(source, /min\(92vh,980px\)/);
  assert.match(source, /background:rgba\(43,36,72,\.10\)/);
  assert.doesNotMatch(source, /backdrop-filter:blur\(/);
  assert.match(source, /backdrop\.addEventListener\("click"/);
  assert.match(source, /\.container\.posts>\.row\{max-width:100%/);
  assert.match(source, /grid-template-columns:minmax\(0,1fr\) 96px/);
  assert.match(source, /--topic-body-width/);
  assert.match(source, /sync_topic_body_width/);
  assert.doesNotMatch(source, /\.topic-body\{width:/);
  assert.match(source, /cloneNode\(true\)/);
  assert.match(source, /ldo-topic-reader-background-snapshot/);
  assert.match(source, /anchor\.href = next_reader\.topic_url/);
  assert.match(source, /content_slot\.scrollTop = 0/);
  assert.doesNotMatch(source, /createElement\("iframe"\)/);
  assert.doesNotMatch(source, /\/posts\.json/);
  assert.doesNotMatch(source, /function sanitize_content/);
});
