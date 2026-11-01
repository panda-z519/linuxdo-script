#!/usr/bin/env node
"use strict";

// 校验远程发布地址上的 @version 是否与本地一致：npm run check-published
// 用于 push 之后确认 GitHub raw 已经更新，避免用户拿到旧版本。

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const USERSCRIPTS_DIR = path.join(ROOT, "userscripts");
const RAW_BASE =
  "https://raw.githubusercontent.com/panda-z519/linuxdo-script/main/";
const ATTEMPTS = 6;
const DELAY_MS = 3000;

function read_version(source) {
  const matched = source.match(/^\/\/\s*@version\s+(\S+)/m);
  return matched ? matched[1] : null;
}

function list_scripts() {
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
          url: new URL(`${RAW_BASE}userscripts/${entry.name}/${file}`).href,
          local_version: read_version(
            fs.readFileSync(path.join(dir, file), "utf8"),
          ),
        }));
    });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetch_version(url) {
  const response = await fetch(`${url}?cache=${Date.now()}`);
  if (!response.ok) {
    return { error: `HTTP ${response.status}` };
  }
  return { version: read_version(await response.text()) };
}

async function main() {
  const scripts = list_scripts();
  let failed = false;

  for (const script of scripts) {
    let remote = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      remote = await fetch_version(script.url).catch((error) => ({
        error: error.message,
      }));
      if (remote.version === script.local_version) {
        break;
      }
      if (attempt < ATTEMPTS - 1) {
        await sleep(DELAY_MS);
      }
    }

    const label = `${script.slug} ${script.file}`;
    if (remote.version === script.local_version) {
      console.log(`✓ ${label} 远程已是 ${remote.version}`);
    } else {
      failed = true;
      const detail = remote.error ? remote.error : `远程 ${remote.version}`;
      console.error(`✗ ${label} 本地 ${script.local_version}，${detail}`);
      console.error(`  ${script.url}`);
    }
  }

  if (failed) {
    console.error(
      "\n发布地址与本地版本不一致：确认已经 push 到 main，或稍等 GitHub 刷新后重试。",
    );
    process.exitCode = 1;
  }
}

main();
