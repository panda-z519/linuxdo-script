#!/usr/bin/env node
"use strict";

// 把 userscripts/ 下的当前脚本归档到 versions/<脚本>/<@version>/。
// used by: npm run archive-version
// 已发布的快照默认不可覆盖：内容不同时需要显式 --force。

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const USERSCRIPTS_DIR = path.join(ROOT, "userscripts");
const VERSIONS_DIR = path.join(ROOT, "versions");

function read_metadata(source) {
  const version = source.match(/^\/\/\s*@version\s+(\S+)/m);
  const name = source.match(/^\/\/\s*@name\s+(.+)$/m);
  return {
    version: version ? version[1] : null,
    name: name ? name[1].trim() : null,
  };
}

function list_current_scripts() {
  return fs
    .readdirSync(USERSCRIPTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = path.join(USERSCRIPTS_DIR, entry.name);
      return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".user.js"))
        .map((file) => ({
          slug: entry.name,
          file: file,
          path: path.join(dir, file),
        }));
    });
}

function main() {
  const force = process.argv.includes("--force");
  const problems = [];
  const archived = [];

  for (const script of list_current_scripts()) {
    const { version } = read_metadata(fs.readFileSync(script.path, "utf8"));
    if (!version) {
      problems.push(`${script.slug}: 读不到 @version`);
      continue;
    }
    const target_dir = path.join(VERSIONS_DIR, script.slug, version);
    const target = path.join(target_dir, script.file);
    const next = fs.readFileSync(script.path, "utf8");
    if (fs.existsSync(target)) {
      const current = fs.readFileSync(target, "utf8");
      if (current === next) {
        console.log(`= ${script.slug} ${version} 已归档，内容一致`);
        continue;
      }
      if (!force) {
        problems.push(
          `${script.slug} ${version}: 归档已存在且内容不同，确认是发布新版就 bump @version，确实要覆盖请加 --force`,
        );
        continue;
      }
    }
    fs.mkdirSync(target_dir, { recursive: true });
    fs.writeFileSync(target, next);
    archived.push(
      `${script.slug} ${version} -> versions/${script.slug}/${version}/${script.file}`,
    );
  }

  for (const line of archived) {
    console.log(`+ ${line}`);
  }
  for (const line of problems) {
    console.error(`✗ ${line}`);
  }
  if (problems.length > 0) {
    process.exitCode = 1;
  }
}

main();
