"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const userscripts_dir = path.join(root, "userscripts");
const versions_dir = path.join(root, "versions");

function read_metadata(source) {
  const version = source.match(/^\/\/\s*@version\s+(\S+)/m);
  const name = source.match(/^\/\/\s*@name\s+(.+)$/m);
  return { version: version && version[1], name: name && name[1].trim() };
}

function subdirectories(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function userscript_files(dir) {
  return fs.readdirSync(dir).filter((file) => file.endsWith(".user.js"));
}

function compare_versions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

const current_scripts = subdirectories(userscripts_dir).map((slug) => {
  const dir = path.join(userscripts_dir, slug);
  const files = userscript_files(dir);
  assert.equal(files.length, 1, `userscripts/${slug} 应只放一个 .user.js`);
  const source = fs.readFileSync(path.join(dir, files[0]), "utf8");
  return { slug, file: files[0], source, ...read_metadata(source) };
});

test("每个当前脚本都有版本号和名称", () => {
  assert.ok(current_scripts.length > 0, "userscripts/ 下没有找到脚本");
  for (const script of current_scripts) {
    assert.match(
      script.version || "",
      /^\d+(\.\d+)*$/,
      `${script.slug} 的 @version 不合法`,
    );
    assert.ok(script.name, `${script.slug} 缺少 @name`);
  }
});

test("归档目录的版本号与其脚本 @version 一致", () => {
  for (const slug of subdirectories(versions_dir)) {
    const slug_dir = path.join(versions_dir, slug);
    for (const version of subdirectories(slug_dir)) {
      const version_dir = path.join(slug_dir, version);
      const files = userscript_files(version_dir);
      assert.equal(
        files.length,
        1,
        `versions/${slug}/${version} 应只放一个 .user.js`,
      );
      const source = fs.readFileSync(path.join(version_dir, files[0]), "utf8");
      const metadata = read_metadata(source);
      assert.equal(
        metadata.version,
        version,
        `versions/${slug}/${version}/${files[0]} 的 @version 是 ${metadata.version}，与目录名不符`,
      );
      const current = current_scripts.find((script) => script.slug === slug);
      assert.ok(current, `versions/${slug} 没有对应的 userscripts/${slug}`);
      assert.equal(
        metadata.name,
        current.name,
        `versions/${slug}/${version} 的 @name 与 userscripts/${slug} 不一致`,
      );
    }
  }
});

test("归档版本不高于当前版本", () => {
  for (const script of current_scripts) {
    const slug_dir = path.join(versions_dir, script.slug);
    for (const version of subdirectories(slug_dir)) {
      assert.ok(
        compare_versions(version, script.version) <= 0,
        `versions/${script.slug}/${version} 高于当前 @version ${script.version}，应先把脚本版本号提上去`,
      );
    }
  }
});

test("归档快照在发布时与当前脚本一致", () => {
  for (const script of current_scripts) {
    const slug_dir = path.join(versions_dir, script.slug);
    const version = script.version;
    if (!subdirectories(slug_dir).includes(version)) {
      continue;
    }
    const target = path.join(slug_dir, version, script.file);
    assert.ok(
      fs.existsSync(target),
      `versions/${script.slug}/${version}/ 里没有 ${script.file}`,
    );
    assert.equal(
      fs.readFileSync(target, "utf8"),
      script.source,
      `versions/${script.slug}/${version} 与当前脚本不一致；改完脚本后运行 npm run archive-version 归档，或先把 @version 提上去再归档`,
    );
  }
});

const raw_base =
  "https://raw.githubusercontent.com/panda-z519/linuxdo-script/main/";

test("每个脚本都声明指向发布路径的更新地址", () => {
  for (const script of current_scripts) {
    const update = script.source.match(/^\/\/\s*@updateURL\s+(\S+)$/m);
    const download = script.source.match(/^\/\/\s*@downloadURL\s+(\S+)$/m);
    assert.ok(update, `${script.slug} 缺少 @updateURL，脚本管理器无法自动更新`);
    assert.ok(download, `${script.slug} 缺少 @downloadURL`);
    assert.equal(
      update[1],
      download[1],
      `${script.slug} 的 @updateURL 与 @downloadURL 应指向同一地址`,
    );
    assert.equal(
      decodeURIComponent(update[1]),
      `${raw_base}userscripts/${script.slug}/${script.file}`,
      `${script.slug} 的更新地址必须指向仓库中的实际路径`,
    );
  }
});
