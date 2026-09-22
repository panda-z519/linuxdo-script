// ==UserScript==
// @name         linux.do 帖子保存到 Obsidian
// @namespace    https://github.com/panda-z519/linuxdo-script
// @version      0.9.4
// @author       zsq
// @copyright    2026, zsq
// @license      MIT
// @description  抓取 linux.do 主帖与评论，以 Obsidian Markdown 通过 Local REST API 写入 Obsidian
// @match        *://linux.do/*
// @match        *://www.linux.do/*
// @compatible   chrome Tampermonkey
// @compatible   edge Tampermonkey
// @compatible   firefox Tampermonkey
// @compatible   safari Userscripts / Tampermonkey
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @connect      *
// @inject-into  content
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  const SETTINGS_KEY = "linux-do-to-obsidian-settings";
  const ACTIONS_POSITION_KEY = "linux-do-to-obsidian-actions-position";
  const DEFAULT_SETTINGS = {
    api_url: "http://127.0.0.1:27123",
    api_key: "",
    folder: "LinuxDo",
    post_scope: "all",
    save_main_images: true,
    save_comment_images: true,
    download_images: false,
    attachments_folder: "附件/linuxdo",
    file_template: "{id}-{title}",
    save_strategy: "overwrite",
    floor_range: "",
    min_likes: 0,
    category_mapping: "",
    preview_before_save: false,
    enable_shortcut: false,
    shortcut: "mod+shift+s",
  };
  const MAX_RETRIES = 3;
  const POSTS_PER_REQUEST = 20;
  const REQUEST_CONCURRENCY = 3;

  let is_saving = false;

  const style = document.createElement("style");
  style.textContent = `
#ldo-obsidian-actions {
  position: fixed;
  right: 20px;
  bottom: 24px;
  z-index: 9999;
  display: flex;
  gap: 8px;
  align-items: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  cursor: grab;
  user-select: none;
  touch-action: none;
  will-change: left, top;
}
#ldo-obsidian-actions.is-dragging {
  cursor: grabbing;
}
#ldo-obsidian-actions[hidden] {
  display: none;
}
.ldo-obsidian-button {
  border: 0;
  border-radius: 9px;
  padding: 10px 14px;
  color: #fff;
  background: #7c3aed;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
}
.ldo-obsidian-button:hover {
  background: #6d28d9;
}
.ldo-obsidian-button:disabled {
  opacity: 0.7;
  cursor: wait;
}
.ldo-obsidian-settings-button {
  width: 40px;
  padding: 10px 0;
  background: #4b5563;
}
#ldo-obsidian-toast {
  position: fixed;
  right: 20px;
  bottom: 78px;
  z-index: 10001;
  max-width: min(420px, calc(100vw - 40px));
  padding: 10px 14px;
  border-radius: 8px;
  color: #fff;
  background: #111827;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
  font:
    14px/1.5 -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}
#ldo-obsidian-toast[data-type="error"] {
  background: #b91c1c;
}
#ldo-obsidian-toast[data-type="success"] {
  background: #047857;
}
#ldo-obsidian-modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.48);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
#ldo-obsidian-modal form {
  width: min(520px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  box-sizing: border-box;
  padding: 22px;
  border-radius: 12px;
  color: #111827;
  background: #fff;
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.35);
}
#ldo-obsidian-modal h2 {
  margin: 0 0 18px;
  font-size: 20px;
}
#ldo-obsidian-modal label {
  display: block;
  margin: 12px 0 5px;
  font-weight: 600;
}
#ldo-obsidian-modal input,
#ldo-obsidian-modal select,
#ldo-obsidian-modal textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  color: #111827;
  background: #fff;
  font-size: 14px;
}
#ldo-obsidian-modal textarea {
  min-height: 72px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
#ldo-obsidian-modal .ldo-help {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 12px;
}
#ldo-obsidian-modal .ldo-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
#ldo-obsidian-modal .ldo-checkbox {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 500;
}
#ldo-obsidian-modal .ldo-checkbox input {
  width: auto;
  margin: 0;
}
#ldo-obsidian-modal .ldo-status {
  min-height: 20px;
  margin-top: 12px;
  font-size: 13px;
}
#ldo-obsidian-modal .ldo-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
#ldo-obsidian-modal button {
  padding: 8px 12px;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
}
#ldo-obsidian-modal .ldo-primary {
  color: #fff;
  background: #7c3aed;
}
#ldo-obsidian-modal .ldo-secondary {
  color: #111827;
  background: #e5e7eb;
}
#ldo-obsidian-preview {
  display: flex;
  flex-direction: column;
  width: min(1760px, calc(100vw - 24px));
  height: calc(100vh - 24px);
  min-width: min(760px, calc(100vw - 24px));
  min-height: min(560px, calc(100vh - 24px));
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  padding: 0;
  overflow: hidden;
  resize: both;
}
#ldo-obsidian-preview .ldo-preview-header {
  padding: 18px 20px 12px;
  border-bottom: 1px solid #e5e7eb;
}
#ldo-obsidian-preview h2 {
  margin: 0 0 8px;
}
#ldo-obsidian-preview .ldo-preview-path {
  margin: 0;
  color: #6b7280;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow-wrap: anywhere;
}
#ldo-obsidian-preview .ldo-preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
#ldo-obsidian-preview .ldo-preview-stats span {
  padding: 3px 7px;
  border-radius: 999px;
  color: #374151;
  background: #f3f4f6;
  font-size: 12px;
}
#ldo-obsidian-preview .ldo-preview-body {
  flex: 1 1 auto;
  min-height: 0;
}
#ldo-obsidian-preview .ldo-preview-rendered {
  min-height: 0;
  overflow: auto;
  box-sizing: border-box;
  height: 100%;
  padding: 22px 28px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
#ldo-obsidian-preview .ldo-preview-rendered h1,
#ldo-obsidian-preview .ldo-preview-rendered h2,
#ldo-obsidian-preview .ldo-preview-rendered h3 {
  margin: 1em 0 0.45em;
  line-height: 1.25;
}
#ldo-obsidian-preview .ldo-preview-rendered h1:first-child,
#ldo-obsidian-preview .ldo-preview-rendered h2:first-child,
#ldo-obsidian-preview .ldo-preview-rendered h3:first-child {
  margin-top: 0;
}
#ldo-obsidian-preview .ldo-preview-rendered pre {
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
  background: #f3f4f6;
}
#ldo-obsidian-preview .ldo-preview-rendered code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
#ldo-obsidian-preview .ldo-preview-rendered blockquote {
  margin: 12px 0;
  padding: 8px 12px;
  border-left: 3px solid #a78bfa;
  background: #f5f3ff;
}
#ldo-obsidian-preview .ldo-preview-rendered img {
  max-width: 100%;
  border-radius: 8px;
}
#ldo-obsidian-preview .ldo-dialog-actions {
  position: sticky;
  bottom: 0;
  margin-top: 0;
  padding: 12px 20px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
#ldo-obsidian-toast button {
  margin: 8px 0 0;
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  color: #111827;
  background: #fff;
  cursor: pointer;
}
@media (prefers-color-scheme: dark) {
  #ldo-obsidian-modal form {
    color: #f9fafb;
    background: #1f2937;
  }
  #ldo-obsidian-modal input,
  #ldo-obsidian-modal select,
  #ldo-obsidian-modal textarea {
    color: #f9fafb;
    background: #111827;
    border-color: #4b5563;
  }
  #ldo-obsidian-modal .ldo-help {
    color: #9ca3af;
  }
  #ldo-obsidian-preview .ldo-preview-header,
  #ldo-obsidian-preview .ldo-dialog-actions {
    border-color: #374151;
    background: #1f2937;
  }
  #ldo-obsidian-preview .ldo-preview-path {
    color: #9ca3af;
  }
  #ldo-obsidian-preview .ldo-preview-stats span {
    color: #e5e7eb;
    background: #374151;
  }
  #ldo-obsidian-preview .ldo-preview-rendered pre,
  #ldo-obsidian-preview .ldo-preview-rendered blockquote {
    background: #111827;
  }
}
@media (max-width: 1180px) {
  #ldo-obsidian-preview {
    min-width: min(360px, calc(100vw - 24px));
  }
}
  `;
  document.head.append(style);

  async function load_settings() {
    const stored = await GM.getValue(SETTINGS_KEY, {});
    if (!stored || typeof stored !== "object") {
      return { ...DEFAULT_SETTINGS };
    }
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    if (!new Set(["main", "author", "all"]).has(settings.post_scope)) {
      settings.post_scope = stored.include_replies === false ? "main" : "all";
    }
    settings.save_main_images = settings.save_main_images !== false;
    settings.save_comment_images = settings.save_comment_images !== false;
    settings.download_images = settings.download_images === true;
    settings.preview_before_save = settings.preview_before_save === true;
    settings.enable_shortcut = settings.enable_shortcut === true;
    if (
      !new Set(["overwrite", "skip", "timestamp", "merge"]).has(
        settings.save_strategy,
      )
    ) {
      settings.save_strategy = DEFAULT_SETTINGS.save_strategy;
    }
    settings.min_likes = Math.max(0, Number(settings.min_likes) || 0);
    settings.attachments_folder = String(
      settings.attachments_folder || "",
    ).trim();
    settings.file_template =
      String(settings.file_template || "").trim() ||
      DEFAULT_SETTINGS.file_template;
    settings.floor_range = String(settings.floor_range || "").trim();
    settings.category_mapping = String(settings.category_mapping || "").trim();
    settings.shortcut =
      String(settings.shortcut || "").trim() || DEFAULT_SETTINGS.shortcut;
    return settings;
  }

  async function save_settings(settings) {
    await GM.setValue(SETTINGS_KEY, settings);
  }

  function get_topic_id() {
    const match = window.location.pathname.match(
      /^\/t\/(?:[^/]+\/)?(\d+)(?:\/\d+)?\/?$/,
    );
    return match ? match[1] : null;
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function show_toast(message, type = "info", duration = 4000, action = null) {
    document.getElementById("ldo-obsidian-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "ldo-obsidian-toast";
    toast.dataset.type = type;
    const message_node = document.createElement("div");
    message_node.textContent = message;
    toast.append(message_node);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        toast.remove();
        action.handler();
      });
      toast.append(button);
    }
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function set_save_button_state(text, disabled) {
    const button = document.getElementById("ldo-obsidian-save");
    if (!button) {
      return;
    }
    button.textContent = text;
    button.disabled = disabled;
  }

  function format_error(error) {
    return error instanceof Error ? error.message : String(error);
  }

  async function fetch_json(url) {
    let last_error;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout_id = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(url, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (response.ok) {
          return await response.json();
        }
        const can_retry = response.status === 429 || response.status >= 500;
        if (!can_retry) {
          throw new Error(`linux.do 请求失败：HTTP ${response.status}`);
        }
        last_error = new Error(`linux.do 暂时不可用：HTTP ${response.status}`);
        const retry_after = Number(response.headers.get("Retry-After"));
        const wait_time =
          Number.isFinite(retry_after) && retry_after > 0
            ? retry_after * 1000
            : 800 * 2 ** attempt;
        await sleep(wait_time);
      } catch (error) {
        last_error = error;
        if (
          error instanceof Error &&
          error.message.startsWith("linux.do 请求失败")
        ) {
          throw error;
        }
        if (attempt < MAX_RETRIES - 1) {
          await sleep(800 * 2 ** attempt);
        }
      } finally {
        window.clearTimeout(timeout_id);
      }
    }
    throw new Error(`抓取帖子失败：${format_error(last_error)}`);
  }

  function split_into_chunks(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  async function fetch_category_name(topic) {
    const direct_name = String(
      topic.category?.name || topic.category_name || "",
    ).trim();
    if (direct_name) {
      return direct_name;
    }
    if (!topic.category_id) {
      return "未分类";
    }
    try {
      const site = await fetch_json("/site.json");
      const category = (site.categories || []).find(
        (item) => item.id === topic.category_id,
      );
      return String(category?.name || "").trim() || "未分类";
    } catch {
      return "未分类";
    }
  }

  async function fetch_topic(topic_id, post_scope, on_progress) {
    on_progress("正在读取主题…");
    const topic = await fetch_json(`/t/${topic_id}.json`);
    on_progress("正在读取分类…");
    topic.category_name = await fetch_category_name(topic);
    const loaded_posts = topic.post_stream?.posts || [];
    const post_map = new Map(loaded_posts.map((post) => [post.id, post]));
    const stream =
      topic.post_stream?.stream || loaded_posts.map((post) => post.id);

    if (post_scope === "main") {
      const first_post_id = stream[0];
      if (!post_map.has(first_post_id) && first_post_id) {
        const query = `post_ids%5B%5D=${encodeURIComponent(first_post_id)}`;
        const result = await fetch_json(`/t/${topic_id}/posts.json?${query}`);
        for (const post of result.post_stream?.posts || []) {
          post_map.set(post.id, post);
        }
      }
      topic.downloaded_posts = [post_map.get(first_post_id)].filter(
        (post) => post?.cooked && post.post_type === 1,
      );
      return topic;
    }

    const missing_ids = stream.filter((post_id) => !post_map.has(post_id));
    const chunks = split_into_chunks(missing_ids, POSTS_PER_REQUEST);
    let next_chunk_index = 0;

    async function worker() {
      while (next_chunk_index < chunks.length) {
        const chunk_index = next_chunk_index;
        next_chunk_index += 1;
        const post_ids = chunks[chunk_index];
        const query = post_ids
          .map((post_id) => `post_ids%5B%5D=${encodeURIComponent(post_id)}`)
          .join("&");
        const result = await fetch_json(`/t/${topic_id}/posts.json?${query}`);
        for (const post of result.post_stream?.posts || []) {
          post_map.set(post.id, post);
        }
        on_progress(`正在抓取楼层 ${post_map.size}/${stream.length}…`);
      }
    }

    const worker_count = Math.min(REQUEST_CONCURRENCY, chunks.length);
    await Promise.all(Array.from({ length: worker_count }, () => worker()));
    const downloaded_posts = Array.from(post_map.values())
      .filter((post) => post?.cooked && post.post_type === 1)
      .sort((left, right) => left.post_number - right.post_number);
    const first_post = downloaded_posts[0];
    topic.downloaded_posts =
      post_scope === "author"
        ? downloaded_posts.filter(
            (post) =>
              post.post_number === 1 || post.username === first_post?.username,
          )
        : downloaded_posts;
    return topic;
  }

  function parse_floor_range(value) {
    const rules = String(value || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (rules.length === 0) {
      return () => true;
    }
    return (post_number) =>
      rules.some((rule) => {
        const range_match = rule.match(/^(\d*)\s*-\s*(\d*)$/);
        if (range_match) {
          const start = range_match[1] ? Number(range_match[1]) : 1;
          const end = range_match[2] ? Number(range_match[2]) : Infinity;
          return post_number >= start && post_number <= end;
        }
        return Number(rule) === post_number;
      });
  }

  function get_post_like_count(post) {
    const direct_value =
      post.like_count ?? post.likes_count ?? post.likes ?? post.score;
    if (Number.isFinite(Number(direct_value))) {
      return Number(direct_value);
    }
    const like_action = (post.actions_summary || []).find(
      (action) =>
        ["like", 2].includes(action.id) || /like|点赞/i.test(action.name || ""),
    );
    return Number(like_action?.count || 0);
  }

  function apply_post_filters(topic, settings) {
    const posts = topic.downloaded_posts || [];
    const in_range = parse_floor_range(settings.floor_range);
    const min_likes = Math.max(0, Number(settings.min_likes) || 0);
    topic.downloaded_posts = posts.filter((post) => {
      const post_number = Number(post.post_number);
      if (post_number === 1) {
        return true;
      }
      return in_range(post_number) && get_post_like_count(post) >= min_likes;
    });
    return topic;
  }

  function parse_category_mapping(value) {
    return new Map(
      String(value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.includes("=>") ? "=>" : "=";
          const [source, target] = line.split(separator);
          return [String(source || "").trim(), String(target || "").trim()];
        })
        .filter(([source, target]) => source && target),
    );
  }

  function apply_category_mapping(topic, settings) {
    const category_mapping = parse_category_mapping(settings.category_mapping);
    const mapped = category_mapping.get(topic.category_name);
    if (mapped) {
      topic.original_category_name = topic.category_name;
      topic.category_name = mapped;
    }
  }

  function format_compact_timestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      "-",
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join("");
  }

  function make_absolute_url(value) {
    if (!value || /^(?:#|data:|mailto:|obsidian:)/i.test(value)) {
      return value;
    }
    try {
      return new URL(value, "https://linux.do").href;
    } catch {
      return value;
    }
  }

  function normalize_code_language(language, value) {
    const normalized = String(language || "").toLowerCase();
    if (normalized && normalized !== "auto") {
      return normalized;
    }
    if (/\b(?:irm|invoke-restmethod)\b|\|\s*iex\b|\$env:/i.test(value)) {
      return "powershell";
    }
    if (
      /^\s*(?:#!.*\b(?:bash|sh)|(?:sudo\s+)?(?:bash|sh|curl|wget)\b)/im.test(
        value,
      )
    ) {
      return "bash";
    }
    const trimmed = value.trim();
    if (trimmed && /^[\[{]/.test(trimmed)) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // 不是合法 JSON，继续按纯文本处理。
      }
    }
    return "text";
  }

  function quote_markdown(markdown, prefix = "> ") {
    return String(markdown || "")
      .split("\n")
      .map((line) => (line ? `${prefix}${line}` : prefix.trimEnd()))
      .join("\n");
  }

  function cooked_html_to_markdown(
    cooked,
    saved_post_numbers,
    source_url,
    options = {},
  ) {
    const save_images = options.save_images !== false;
    const image_rewrites = options.image_rewrites || new Map();
    const container = document.createElement("div");
    container.innerHTML = cooked || "";
    container
      .querySelectorAll(
        "script, style, iframe, object, embed, form, button, .lightbox-wrapper .meta",
      )
      .forEach((node) => node.remove());

    container.querySelectorAll("img.emoji").forEach((image) => {
      image.replaceWith(
        document.createTextNode(image.getAttribute("alt") || ""),
      );
    });
    container.querySelectorAll("a.anchor").forEach((anchor) => anchor.remove());

    const code_blocks = new Map();
    let code_block_index = 0;

    function render_children(element) {
      return Array.from(element.childNodes)
        .map((node) => render_node(node))
        .join("");
    }

    function render_list(element, ordered) {
      const items = Array.from(element.children).filter(
        (child) => child.tagName === "LI",
      );
      return (
        items
          .map((item, index) => {
            const nested_lists = Array.from(item.children).filter((child) =>
              ["UL", "OL"].includes(child.tagName),
            );
            const body = Array.from(item.childNodes)
              .filter((node) => !nested_lists.includes(node))
              .map((node) => render_node(node))
              .join("")
              .trim()
              .replace(/\n{2,}/g, "\n");
            const marker = ordered ? `${index + 1}. ` : "- ";
            const body_lines = body.split("\n");
            const rendered_body = body_lines
              .map((line, line_index) =>
                line_index === 0 ? `${marker}${line}` : `  ${line}`,
              )
              .join("\n");
            const rendered_nested = nested_lists
              .map((nested) => render_node(nested).trim())
              .filter(Boolean)
              .map((nested) =>
                nested
                  .split("\n")
                  .map((line) => `  ${line}`)
                  .join("\n"),
              )
              .join("\n");
            return [rendered_body, rendered_nested].filter(Boolean).join("\n");
          })
          .join("\n") + "\n\n"
      );
    }

    function render_table(element) {
      const rows = Array.from(element.rows || []);
      if (rows.length === 0) {
        return "";
      }
      const values = rows.map((row) =>
        Array.from(row.cells).map((cell) =>
          render_children(cell)
            .trim()
            .replace(/\|/g, "\\|")
            .replace(/\s*\n+\s*/g, " / "),
        ),
      );
      const width = Math.max(...values.map((row) => row.length));
      const normalized = values.map((row) => [
        ...row,
        ...Array.from({ length: width - row.length }, () => ""),
      ]);
      return [
        `| ${normalized[0].join(" | ")} |`,
        `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
        ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
        "",
      ].join("\n");
    }

    function render_node(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return String(node.nodeValue || "").replace(/[\t\r\n ]+/g, " ");
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const element = node;
      const tag = element.tagName;
      const body = () => render_children(element).trim();

      if (tag === "BR") return "\n";
      if (/^H[1-6]$/.test(tag)) {
        const level = Math.min(Number(tag.slice(1)) + 2, 6);
        return `${"#".repeat(level)} ${body()}\n\n`;
      }
      if (
        ["P", "DIV", "SECTION", "ARTICLE", "FIGURE", "FIGCAPTION"].includes(tag)
      ) {
        const content = body();
        return content ? `${content}\n\n` : "";
      }
      if (["STRONG", "B"].includes(tag)) return `**${body()}**`;
      if (["EM", "I"].includes(tag)) return `*${body()}*`;
      if (["DEL", "S", "STRIKE"].includes(tag)) return `~~${body()}~~`;
      if (tag === "MARK") return `==${body()}==`;
      if (tag === "A") {
        const href = make_absolute_url(element.getAttribute("href") || "");
        const label = body() || href;
        return href ? `[${label}](${href})` : label;
      }
      if (tag === "IMG") {
        if (!save_images) {
          return element.getAttribute("alt") || "";
        }
        const source =
          element.getAttribute("data-orig-src") ||
          element.getAttribute("data-large-uri") ||
          element.getAttribute("data-src") ||
          element.getAttribute("src");
        if (!source) return element.getAttribute("alt") || "";
        const alt = String(element.getAttribute("alt") || "图片").replace(
          /[\[\]]/g,
          "",
        );
        const absolute_source = make_absolute_url(source);
        return `![${alt}](<${image_rewrites.get(absolute_source) || absolute_source}>)`;
      }
      if (["VIDEO", "AUDIO"].includes(tag)) {
        const source =
          element.getAttribute("src") ||
          element.querySelector("source")?.getAttribute("src");
        const label = tag === "VIDEO" ? "视频" : "音频";
        return source ? `[${label}](${make_absolute_url(source)})` : "";
      }
      if (tag === "PRE") {
        const code = element.querySelector("code");
        const value = String(
          code?.textContent || element.textContent || "",
        ).replace(/^\n|\n$/g, "");
        const class_name = code?.className || element.className || "";
        const language = class_name.match(/(?:lang(?:uage)?-)([\w+-]+)/i)?.[1];
        const fence_size = Math.max(
          3,
          ...Array.from(value.matchAll(/`+/g), (match) => match[0].length + 1),
        );
        const fence = "`".repeat(fence_size);
        const token = `LDO_CODE_BLOCK_${code_block_index}_PLACEHOLDER`;
        code_block_index += 1;
        code_blocks.set(
          token,
          `${fence}${normalize_code_language(language, value)}\n${value}\n${fence}`,
        );
        return `\n\n${token}\n\n`;
      }
      if (tag === "CODE") {
        const value = element.textContent || "";
        const fence = "`".repeat(
          Math.max(
            1,
            ...Array.from(
              value.matchAll(/`+/g),
              (match) => match[0].length + 1,
            ),
          ),
        );
        return `${fence}${value}${fence}`;
      }
      if (tag === "ASIDE" && element.classList.contains("quote")) {
        const title_element =
          element.querySelector(".quote-title__text-content a") ||
          element.querySelector(".title a") ||
          element.querySelector(".title");
        const title = String(title_element?.textContent || "引用")
          .replace(/\s+/g, " ")
          .trim();
        const quoted = element.querySelector("blockquote");
        const content = quoted ? render_children(quoted).trim() : body();
        return (
          [`> [!quote] ${title}`, quote_markdown(content), ""].join("\n") + "\n"
        );
      }
      if (tag === "BLOCKQUOTE") {
        return `${quote_markdown(body())}\n\n`;
      }
      if (tag === "UL") return render_list(element, false);
      if (tag === "OL") return render_list(element, true);
      if (tag === "TABLE") return render_table(element);
      if (tag === "HR") return "\n---\n\n";
      if (tag === "KBD") return `\`${element.textContent || ""}\``;
      return render_children(element);
    }

    let markdown = render_children(container)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    for (const [token, code_block] of code_blocks) {
      markdown = markdown.replace(token, code_block);
    }

    return markdown;
  }

  function yaml_string(value) {
    return JSON.stringify(String(value ?? ""));
  }

  function format_date_time(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(date)
      .replaceAll("/", "-");
  }

  function post_scope_label(post_scope) {
    return (
      {
        main: "只保存主帖",
        author: "主帖 + 楼主回复",
        all: "全部楼层",
      }[post_scope] || "全部楼层"
    );
  }

  function format_post_author(post) {
    const username = post.username || post.display_username || "unknown";
    const display_name = String(post.name || "").trim();
    if (display_name && display_name.toLowerCase() !== username.toLowerCase()) {
      return `${display_name} (@${username})`;
    }
    return `@${username}`;
  }

  function format_post_heading(post, is_topic_author) {
    const owner_marker = is_topic_author ? " · 楼主" : "";
    return `### #${post.post_number} ${format_post_author(post)}${owner_marker}`;
  }

  function sanitize_file_segment(value, fallback) {
    const sanitized = String(value || "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim();
    return (sanitized || fallback).slice(0, 90);
  }

  function build_file_name(settings, topic) {
    const created_at = topic.created_at
      ? new Date(topic.created_at)
      : new Date();
    const date = Number.isNaN(created_at.getTime())
      ? new Date().toISOString().slice(0, 10)
      : created_at.toISOString().slice(0, 10);
    const values = {
      id: topic.id,
      title: topic.title,
      category: topic.category_name || "未分类",
      date,
      slug: topic.slug || "topic",
      timestamp: format_compact_timestamp(),
    };
    const template = settings.file_template || DEFAULT_SETTINGS.file_template;
    const file_name = template.replace(/\{(\w+)\}/g, (match, key) =>
      values[key] == null ? match : String(values[key]),
    );
    return sanitize_file_segment(file_name, `${topic.id}-${topic.title}`);
  }

  function build_folder_segments(base_folder, topic) {
    const folder_segments = String(base_folder || "")
      .split("/")
      .map((segment) => sanitize_file_segment(segment, ""))
      .filter(Boolean);
    const category_segments = String(topic.category_name || "未分类")
      .split("/")
      .map((segment) => sanitize_file_segment(segment, ""))
      .filter(Boolean);
    for (const category of category_segments) {
      if (folder_segments[folder_segments.length - 1] !== category) {
        folder_segments.push(category);
      }
    }
    return folder_segments;
  }

  function build_vault_path(settings, topic) {
    const folder_segments = build_folder_segments(settings.folder, topic);
    let file_name = build_file_name(settings, topic);
    if (settings.save_strategy === "timestamp") {
      file_name = `${file_name}-${format_compact_timestamp()}`;
    }
    return [...folder_segments, `${file_name}.md`].join("/");
  }

  function build_markdown(topic, settings, image_rewrites = new Map()) {
    const post_scope = settings.post_scope;
    const posts = topic.downloaded_posts || [];
    if (posts.length === 0) {
      throw new Error("没有拿到可保存的正文，可能是主题权限不足");
    }

    const first_post = posts[0];
    const topic_author =
      first_post.username || first_post.display_username || "unknown";
    const saved_post_numbers = new Set(
      posts.map((post) => Number(post.post_number)),
    );
    const source_url = `https://linux.do/t/${topic.slug || "topic"}/${topic.id}`;
    const source_tags = Array.isArray(topic.tags)
      ? topic.tags
          .map((tag) => (typeof tag === "string" ? tag : tag?.name))
          .filter(Boolean)
      : [];
    const tags = Array.from(new Set(["linux-do", ...source_tags]));
    const total_post_count =
      topic.posts_count || topic.post_stream?.stream?.length || posts.length;
    const saved_at = new Date().toISOString();
    const frontmatter = [
      "---",
      `title: ${yaml_string(topic.title)}`,
      `source: ${yaml_string(source_url)}`,
      "source_site: linux.do",
      `topic_id: ${topic.id}`,
      `category: ${yaml_string(topic.category_name || "未分类")}`,
      `author: ${yaml_string(topic_author)}`,
      `created_at: ${yaml_string(topic.created_at || first_post.created_at)}`,
      `updated_at: ${yaml_string(topic.last_posted_at || first_post.updated_at)}`,
      `saved_at: ${yaml_string(saved_at)}`,
      `post_count: ${total_post_count}`,
      topic.original_category_name
        ? `original_category: ${yaml_string(topic.original_category_name)}`
        : "",
      `tags: ${JSON.stringify(tags)}`,
      "---",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const sections = posts.map((post) => {
      const author = post.username || post.display_username || "unknown";
      const is_topic_author = author === topic_author;
      const post_url = `${source_url}/${post.post_number}`;
      const reply_target = Number(post.reply_to_post_number);
      const reply_line = reply_target ? `↩ 回复 #${reply_target} 楼` : "";
      const should_save_images =
        Number(post.post_number) === 1
          ? settings.save_main_images
          : settings.save_comment_images;
      const body = cooked_html_to_markdown(
        post.cooked,
        saved_post_numbers,
        source_url,
        { image_rewrites, save_images: should_save_images },
      );
      const meta_line = [
        format_date_time(post.created_at),
        `[原帖链接](${post_url})`,
      ]
        .filter(Boolean)
        .join(" · ");
      const reply_line_text = reply_line ? `_${reply_line}_` : "";
      return [
        format_post_heading(post, is_topic_author),
        "",
        `_${meta_line}_`,
        reply_line_text,
        "",
        body || "_该楼层没有可保存的正文。_",
      ].join("\n");
    });

    const meta_line = [
      `[原帖链接](${source_url})`,
      `分类：${topic.category_name || "未分类"}`,
      `楼主：@${topic_author}`,
      `创建：${format_date_time(topic.created_at || first_post.created_at)}`,
      `保存：${posts.length} / ${total_post_count}`,
      `范围：${post_scope_label(post_scope)}`,
    ].join(" · ");
    const tag_line = tags
      .map((tag) => `#${String(tag).trim().replace(/\s+/g, "-")}`)
      .join(" ");
    return [
      frontmatter,
      "",
      `# ${topic.title}`,
      "",
      `_${meta_line}_`,
      "",
      tag_line,
      "",
      sections.join("\n\n---\n\n"),
      "",
    ].join("\n");
  }

  function validate_api_url(value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error("REST API 地址格式不正确");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("REST API 只支持 HTTP 或 HTTPS");
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error(
        "为保护 API Key，REST API 地址只允许 localhost 或 127.0.0.1",
      );
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("REST API 地址不能包含账号、查询参数或锚点");
    }
    return url.origin;
  }

  function normalize_api_key(value) {
    return String(value || "")
      .trim()
      .replace(/^authorization:\s*/i, "")
      .replace(/^bearer\s+/i, "")
      .trim();
  }

  function build_http_zero_message(action, url) {
    const reasons = [
      "没有拿到 HTTP 响应，通常不是 API Key 错误",
      "Obsidian 没运行，或 Local REST API 插件/HTTP 服务没启用",
      "REST API 地址或端口不对，例如 http://127.0.0.1:27123",
      "脚本管理器没有放行本机连接权限，检查 @connect 127.0.0.1 / localhost",
      "如果使用 https，需要先在浏览器里信任 Local REST API 的自签名证书",
      "如果页面是 https 而接口是 http，当前浏览器可能拦截了本机明文请求",
    ];
    return `${action}失败：HTTP 0。请求地址：${url}。${reasons.join("；")}`;
  }

  async function gm_request(options, action = "请求") {
    try {
      return await GM.xmlHttpRequest({
        ...options,
        timeout: 20000,
      });
    } catch (error) {
      throw new Error(
        `${action}失败：无法连接 Obsidian Local REST API。请求地址：${options.url}。底层错误：${format_error(error)}`,
      );
    }
  }

  function assert_rest_response_ok(
    response,
    action,
    url,
    allowed_statuses = [],
  ) {
    if (allowed_statuses.includes(response.status)) {
      return;
    }
    if (response.status === 0) {
      throw new Error(build_http_zero_message(action, url));
    }
    if (response.status === 401) {
      throw new Error(
        `${action}失败：HTTP 401。Local REST API Key 无效或已变更，请在设置里重新粘贴插件里的 API Key`,
      );
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `${action}失败：HTTP ${response.status}。请求地址：${url}`,
      );
    }
  }

  function encode_vault_path(vault_path) {
    return vault_path.split("/").map(encodeURIComponent).join("/");
  }

  function get_response_header(response, name) {
    const pattern = new RegExp(`^${name}:\\s*(.+)$`, "im");
    return String(response.responseHeaders || "")
      .match(pattern)?.[1]
      ?.trim();
  }

  async function put_vault_file(vault_path, data, content_type, settings) {
    const api_url = validate_api_url(settings.api_url);
    const api_key = normalize_api_key(settings.api_key);
    if (!api_key) {
      throw new Error("请先填写 Local REST API Key");
    }
    const url = api_url + "/vault/" + encode_vault_path(vault_path);
    const response = await gm_request(
      {
        method: "PUT",
        url,
        headers: {
          Authorization: "Bearer " + api_key,
          "Content-Type": content_type,
        },
        data,
      },
      "Obsidian 写入",
    );
    assert_rest_response_ok(response, "Obsidian 写入", url);
  }

  async function vault_file_exists(vault_path, settings) {
    const api_url = validate_api_url(settings.api_url);
    const api_key = normalize_api_key(settings.api_key);
    const url = api_url + "/vault/" + encode_vault_path(vault_path);
    const response = await gm_request(
      {
        method: "GET",
        url,
        headers: { Authorization: "Bearer " + api_key },
      },
      "检查已有笔记",
    );
    if (response.status === 404) {
      return false;
    }
    assert_rest_response_ok(response, "检查已有笔记", url);
    return response.status >= 200 && response.status < 300;
  }

  async function get_vault_file_text(vault_path, settings) {
    const api_url = validate_api_url(settings.api_url);
    const api_key = normalize_api_key(settings.api_key);
    const url = api_url + "/vault/" + encode_vault_path(vault_path);
    const response = await gm_request(
      {
        method: "GET",
        url,
        headers: { Authorization: "Bearer " + api_key },
      },
      "读取已有笔记",
    );
    if (response.status === 404) {
      return "";
    }
    assert_rest_response_ok(response, "读取已有笔记", url);
    return String(response.responseText || response.response || "");
  }

  function split_markdown_sections(markdown) {
    return String(markdown || "")
      .split(/\n{2,}(?=#{2,3} #\d+\b|> \[!)/)
      .map((section) => section.trim())
      .filter(Boolean);
  }

  function get_section_floor_number(section) {
    const value = String(section || "");
    return Number(
      value.match(/^#{2,3} #(\d+)/m)?.[1] ||
        value.match(/\^floor-(\d+)/)?.[1] ||
        0,
    );
  }

  function merge_markdown_by_floor(existing_markdown, next_markdown) {
    const next_marker = next_markdown.match(/\n(?=#{2,3} #\d+\b)/)?.index ?? -1;
    const existing_marker =
      existing_markdown.match(/\n(?=#{2,3} #\d+\b)/)?.index ??
      existing_markdown.indexOf("\n## 帖子内容\n\n");
    const next_index = next_marker;
    const existing_index = existing_marker;
    if (next_index < 0 || existing_index < 0) {
      return next_markdown;
    }
    const old_marker = "\n## 帖子内容\n\n";
    const existing_content_index =
      existing_markdown.indexOf(old_marker) === existing_index
        ? existing_index + old_marker.length
        : existing_index + 1;
    const prefix = next_markdown.slice(0, next_index + 1);
    const existing_sections = split_markdown_sections(
      existing_markdown.slice(existing_content_index),
    );
    const next_sections = split_markdown_sections(
      next_markdown.slice(next_index + 1),
    );
    const by_floor = new Map();
    for (const section of existing_sections) {
      by_floor.set(get_section_floor_number(section), section);
    }
    for (const section of next_sections) {
      const floor_number = get_section_floor_number(section);
      if (!by_floor.has(floor_number)) {
        by_floor.set(floor_number, section);
      }
    }
    const sections = Array.from(by_floor.entries())
      .filter(([floor_number]) => floor_number > 0)
      .sort(([left], [right]) => left - right)
      .map(([, section]) => section);
    return [prefix, sections.join("\n\n"), ""].join("");
  }

  async function save_with_rest_api(markdown, vault_path, settings) {
    await put_vault_file(vault_path, markdown, "text/markdown", settings);
  }

  function get_image_source(element) {
    return (
      element.getAttribute("data-orig-src") ||
      element.getAttribute("data-large-uri") ||
      element.getAttribute("data-src") ||
      element.getAttribute("src") ||
      ""
    );
  }

  function get_extension_from_url(url, content_type = "") {
    const pathname = new URL(url, window.location.href).pathname;
    const extension = pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1];
    if (extension) {
      return extension.toLowerCase();
    }
    const type_extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/svg+xml": "svg",
    }[content_type.split(";")[0].toLowerCase()];
    return type_extension || "img";
  }

  function collect_post_images(topic, settings) {
    const images = [];
    for (const post of topic.downloaded_posts || []) {
      const should_save_images =
        Number(post.post_number) === 1
          ? settings.save_main_images
          : settings.save_comment_images;
      if (!should_save_images) {
        continue;
      }
      const container = document.createElement("div");
      container.innerHTML = post.cooked || "";
      for (const image of container.querySelectorAll("img:not(.emoji)")) {
        const source = get_image_source(image);
        if (source && !/^(?:data:|blob:)/i.test(source)) {
          images.push({
            post_number: Number(post.post_number),
            source: make_absolute_url(source),
          });
        }
      }
    }
    return images;
  }

  async function download_binary(url) {
    const response = await gm_request(
      {
        method: "GET",
        url,
        responseType: "arraybuffer",
      },
      "图片下载",
    );
    assert_rest_response_ok(response, "图片下载", url);
    return {
      data: response.response,
      content_type:
        get_response_header(response, "content-type") ||
        "application/octet-stream",
    };
  }

  async function prepare_image_attachments(topic, settings, on_progress) {
    if (!settings.download_images) {
      return new Map();
    }
    const images = collect_post_images(topic, settings);
    const image_rewrites = new Map();
    const base_folder = settings.attachments_folder || "附件/linuxdo";
    const attachment_folder = build_folder_segments(base_folder, topic).join(
      "/",
    );
    let index = 0;
    for (const image of images) {
      index += 1;
      if (image_rewrites.has(image.source)) {
        continue;
      }
      on_progress(`正在保存图片 ${index}/${images.length}…`);
      try {
        const downloaded = await download_binary(image.source);
        const extension = get_extension_from_url(
          image.source,
          downloaded.content_type,
        );
        const file_name = sanitize_file_segment(
          `${topic.id}-${image.post_number}-${index}.${extension}`,
          `${topic.id}-${index}.${extension}`,
        );
        const attachment_path = `${attachment_folder}/${file_name}`;
        await put_vault_file(
          attachment_path,
          downloaded.data,
          downloaded.content_type,
          settings,
        );
        image_rewrites.set(image.source, attachment_path);
      } catch (error) {
        console.warn("linux.do 图片保存失败，保留远程链接：", error);
      }
    }
    return image_rewrites;
  }

  async function test_rest_api(api_url, api_key) {
    const url = validate_api_url(api_url);
    const key = normalize_api_key(api_key);
    if (!key) {
      throw new Error("请填写 Local REST API Key");
    }
    const request_url = url + "/vault/";
    const response = await gm_request(
      {
        method: "GET",
        url: request_url,
        headers: { Authorization: "Bearer " + key },
      },
      "测试 Obsidian 服务",
    );
    assert_rest_response_ok(response, "测试 Obsidian 服务", request_url);
  }

  function escape_html(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function render_inline_markdown(value) {
    return escape_html(value)
      .replace(/!\[([^\]]*)\]\(&lt;([^&]+)&gt;\)/g, '<img alt="$1" src="$2">')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
      )
      .replace(
        /\[\[#\^floor-(\d+)\|([^\]]+)\]\]/g,
        '<a href="#floor-$1">$2</a>',
      )
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function render_markdown_preview(markdown) {
    const body = String(markdown || "").replace(/^---[\s\S]*?---\n+/, "");
    const lines = body.split("\n");
    const html = [];
    let in_code = false;
    let list_open = false;

    function close_list() {
      if (list_open) {
        html.push("</ul>");
        list_open = false;
      }
    }

    for (const line of lines) {
      if (/^```/.test(line)) {
        close_list();
        html.push(in_code ? "</code></pre>" : "<pre><code>");
        in_code = !in_code;
        continue;
      }
      if (in_code) {
        html.push(escape_html(line) + "\n");
        continue;
      }
      if (!line.trim()) {
        close_list();
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        close_list();
        const level = Math.min(heading[1].length, 4);
        const id = line.match(/^#{2,3} #(\d+)/)?.[1]
          ? ` id="floor-${line.match(/^#{2,3} #(\d+)/)?.[1]}"`
          : "";
        html.push(
          `<h${level}${id}>${render_inline_markdown(heading[2])}</h${level}>`,
        );
        continue;
      }
      const list_item = line.match(/^- (.+)$/);
      if (list_item) {
        if (!list_open) {
          html.push("<ul>");
          list_open = true;
        }
        html.push(`<li>${render_inline_markdown(list_item[1])}</li>`);
        continue;
      }
      if (line.startsWith("> ")) {
        close_list();
        html.push(
          `<blockquote>${render_inline_markdown(line.slice(2))}</blockquote>`,
        );
        continue;
      }
      if (/^\^floor-\d+/.test(line)) {
        continue;
      }
      close_list();
      html.push(`<p>${render_inline_markdown(line)}</p>`);
    }
    close_list();
    if (in_code) {
      html.push("</code></pre>");
    }
    return html.join("\n");
  }

  function get_markdown_stats(markdown) {
    const text = String(markdown || "");
    return {
      floors: (text.match(/^#{2,3} #\d+/gm) || []).length,
      images: (text.match(/!\[[^\]]*]\(/g) || []).length,
      words: text.length,
    };
  }

  function show_preview(markdown, vault_path) {
    document.getElementById("ldo-obsidian-modal")?.remove();
    return new Promise((resolve) => {
      const stats = get_markdown_stats(markdown);
      const modal = document.createElement("div");
      modal.id = "ldo-obsidian-modal";
      modal.innerHTML = `
<form id="ldo-obsidian-preview">
  <div class="ldo-preview-header">
    <h2>保存预览</h2>
    <p class="ldo-preview-path"></p>
    <div class="ldo-preview-stats">
      <span>${stats.floors} 个楼层</span>
      <span>${stats.images} 张图片</span>
      <span>${stats.words} 个字符</span>
    </div>
  </div>
  <div class="ldo-preview-body">
    <article class="ldo-preview-rendered"></article>
  </div>
  <div class="ldo-dialog-actions">
    <button class="ldo-secondary" type="button" data-action="cancel">
      取消
    </button>
    <button class="ldo-primary" type="submit">确认保存</button>
  </div>
</form>
      `;
      document.body.append(modal);
      modal.querySelector(".ldo-preview-path").textContent = vault_path;
      modal.querySelector(".ldo-preview-rendered").innerHTML =
        render_markdown_preview(markdown);
      modal
        .querySelector('[data-action="cancel"]')
        .addEventListener("click", () => {
          modal.remove();
          resolve(false);
        });
      modal.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        modal.remove();
        resolve(true);
      });
    });
  }

  async function show_settings() {
    document.getElementById("ldo-obsidian-modal")?.remove();
    const settings = await load_settings();
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.id = "ldo-obsidian-modal";
      modal.innerHTML = `
<form>
  <h2>保存到 Obsidian</h2>
  <label for="ldo-api-url">Local REST API 地址</label>
  <input id="ldo-api-url" type="url" />
  <label for="ldo-api-key">API Key</label>
  <input id="ldo-api-key" type="password" autocomplete="off" />
  <p class="ldo-help">Key 保存在油猴脚本存储中，只会发送到本机地址。</p>
  <button id="ldo-test" class="ldo-secondary" type="button">测试服务</button>
  <label for="ldo-folder">基础目录</label>
  <input id="ldo-folder" type="text" placeholder="例如：LinuxDo" />
  <p class="ldo-help">保存时会自动追加帖子分类，例如：LinuxDo/开发调优。</p>
  <label for="ldo-file-template">文件名模板</label>
  <input id="ldo-file-template" type="text" placeholder="{id}-{title}" />
  <p class="ldo-help">可用变量：{id}、{title}、{category}、{date}、{slug}、{timestamp}。</p>
  <label for="ldo-save-strategy">重复保存策略</label>
  <select id="ldo-save-strategy">
    <option value="overwrite">覆盖同名笔记</option>
    <option value="merge">合并新增楼层</option>
    <option value="skip">已有同名笔记时跳过</option>
    <option value="timestamp">生成带时间戳的新笔记</option>
  </select>
  <label for="ldo-post-scope">帖子范围</label>
  <select id="ldo-post-scope">
    <option value="all">全部楼层（默认）</option>
    <option value="author">主帖 + 楼主回复</option>
    <option value="main">只保存主帖</option>
  </select>
  <p class="ldo-help">默认保存全部评论，所有楼层都展开显示。</p>
  <div class="ldo-row">
    <div>
      <label for="ldo-floor-range">楼层范围</label>
      <input id="ldo-floor-range" type="text" placeholder="例如：1-20,35,50-" />
    </div>
    <div>
      <label for="ldo-min-likes">最低点赞</label>
      <input id="ldo-min-likes" type="number" min="0" step="1" />
    </div>
  </div>
  <label class="ldo-checkbox" for="ldo-save-main-images">
    <input id="ldo-save-main-images" type="checkbox" />
    <span>保存主帖图片</span>
  </label>
  <label class="ldo-checkbox" for="ldo-save-comment-images">
    <input id="ldo-save-comment-images" type="checkbox" />
    <span>保存评论图片</span>
  </label>
  <label class="ldo-checkbox" for="ldo-download-images">
    <input id="ldo-download-images" type="checkbox" />
    <span>下载图片到附件目录</span>
  </label>
  <label for="ldo-attachments-folder">附件目录</label>
  <input id="ldo-attachments-folder" type="text" placeholder="附件/linuxdo" />
  <p class="ldo-help">实际保存时会追加分类映射后的目录，例如：附件/linuxdo/技术/LinuxDo。</p>
  <label for="ldo-category-mapping">分类映射</label>
  <textarea id="ldo-category-mapping" placeholder="开发调优=技术/LinuxDo"></textarea>
  <p class="ldo-help">每行一条，格式：linux.do 分类=Obsidian 目录名。</p>
  <label class="ldo-checkbox" for="ldo-preview-before-save">
    <input id="ldo-preview-before-save" type="checkbox" />
    <span>保存前预览 Markdown</span>
  </label>
  <label class="ldo-checkbox" for="ldo-enable-shortcut">
    <input id="ldo-enable-shortcut" type="checkbox" />
    <span>启用快捷键保存</span>
  </label>
  <label for="ldo-shortcut">快捷键</label>
  <input id="ldo-shortcut" type="text" placeholder="mod+shift+s" />
  <div class="ldo-status" aria-live="polite"></div>
  <div class="ldo-dialog-actions">
    <button class="ldo-secondary" type="button" data-action="cancel">
      取消
    </button>
    <button class="ldo-primary" type="submit">保存设置</button>
  </div>
</form>
      `;
      document.body.append(modal);

      const form = modal.querySelector("form");
      const api_url_input = modal.querySelector("#ldo-api-url");
      const api_key_input = modal.querySelector("#ldo-api-key");
      const folder_input = modal.querySelector("#ldo-folder");
      const file_template_input = modal.querySelector("#ldo-file-template");
      const save_strategy_input = modal.querySelector("#ldo-save-strategy");
      const post_scope_input = modal.querySelector("#ldo-post-scope");
      const floor_range_input = modal.querySelector("#ldo-floor-range");
      const min_likes_input = modal.querySelector("#ldo-min-likes");
      const save_main_images_input = modal.querySelector(
        "#ldo-save-main-images",
      );
      const save_comment_images_input = modal.querySelector(
        "#ldo-save-comment-images",
      );
      const download_images_input = modal.querySelector("#ldo-download-images");
      const attachments_folder_input = modal.querySelector(
        "#ldo-attachments-folder",
      );
      const category_mapping_input = modal.querySelector(
        "#ldo-category-mapping",
      );
      const preview_before_save_input = modal.querySelector(
        "#ldo-preview-before-save",
      );
      const enable_shortcut_input = modal.querySelector("#ldo-enable-shortcut");
      const shortcut_input = modal.querySelector("#ldo-shortcut");
      const status = modal.querySelector(".ldo-status");
      const test_button = modal.querySelector("#ldo-test");

      api_url_input.value = settings.api_url;
      api_key_input.value = settings.api_key;
      folder_input.value = settings.folder;
      file_template_input.value = settings.file_template;
      save_strategy_input.value = settings.save_strategy;
      post_scope_input.value = settings.post_scope;
      floor_range_input.value = settings.floor_range;
      min_likes_input.value = settings.min_likes;
      save_main_images_input.checked = settings.save_main_images;
      save_comment_images_input.checked = settings.save_comment_images;
      download_images_input.checked = settings.download_images;
      attachments_folder_input.value = settings.attachments_folder;
      category_mapping_input.value = settings.category_mapping;
      preview_before_save_input.checked = settings.preview_before_save;
      enable_shortcut_input.checked = settings.enable_shortcut;
      shortcut_input.value = settings.shortcut;

      function close(result) {
        modal.remove();
        resolve(result);
      }

      modal
        .querySelector('[data-action="cancel"]')
        .addEventListener("click", () => close(false));
      test_button.addEventListener("click", async () => {
        status.textContent = "正在测试…";
        test_button.disabled = true;
        try {
          await test_rest_api(api_url_input.value, api_key_input.value);
          status.textContent = "服务可以连接。";
        } catch (error) {
          status.textContent = format_error(error);
        } finally {
          test_button.disabled = false;
        }
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const next_settings = {
            api_url: api_url_input.value.trim(),
            api_key: normalize_api_key(api_key_input.value),
            folder: folder_input.value.trim(),
            file_template: file_template_input.value.trim(),
            save_strategy: save_strategy_input.value,
            post_scope: post_scope_input.value,
            floor_range: floor_range_input.value.trim(),
            min_likes: Math.max(0, Number(min_likes_input.value) || 0),
            save_main_images: save_main_images_input.checked,
            save_comment_images: save_comment_images_input.checked,
            download_images: download_images_input.checked,
            attachments_folder: attachments_folder_input.value.trim(),
            category_mapping: category_mapping_input.value.trim(),
            preview_before_save: preview_before_save_input.checked,
            enable_shortcut: enable_shortcut_input.checked,
            shortcut: shortcut_input.value.trim(),
          };
          next_settings.api_url = validate_api_url(next_settings.api_url);
          if (!next_settings.api_key) {
            throw new Error("请填写 Local REST API Key");
          }
          await save_settings(next_settings);
          close(true);
        } catch (error) {
          status.textContent = format_error(error);
        }
      });
    });
  }

  async function save_current_topic() {
    if (is_saving) {
      return;
    }
    const topic_id = get_topic_id();
    if (!topic_id) {
      show_toast("当前页面不是 linux.do 主题页", "error");
      return;
    }

    let settings = await load_settings();
    if (!settings.api_key) {
      const saved = await show_settings();
      if (!saved) {
        return;
      }
      settings = await load_settings();
    }

    is_saving = true;
    set_save_button_state("准备中…", true);
    try {
      const topic = await fetch_topic(
        topic_id,
        settings.post_scope,
        (message) => {
          set_save_button_state(message, true);
        },
      );
      apply_category_mapping(topic, settings);
      apply_post_filters(topic, settings);
      set_save_button_state("正在转换…", true);
      const vault_path = build_vault_path(settings, topic);
      let markdown = build_markdown(topic, settings);

      if (
        settings.save_strategy === "skip" &&
        (await vault_file_exists(vault_path, settings))
      ) {
        show_toast(`已存在，已跳过：${vault_path}`, "info", 6000);
        return;
      }
      if (
        settings.save_strategy === "merge" &&
        (await vault_file_exists(vault_path, settings))
      ) {
        set_save_button_state("正在合并…", true);
        markdown = merge_markdown_by_floor(
          await get_vault_file_text(vault_path, settings),
          markdown,
        );
      }

      if (settings.preview_before_save) {
        const confirmed = await show_preview(markdown, vault_path);
        if (!confirmed) {
          show_toast("已取消保存", "info", 4000);
          return;
        }
      }

      if (settings.download_images) {
        const image_rewrites = await prepare_image_attachments(
          topic,
          settings,
          (message) => set_save_button_state(message, true),
        );
        markdown = build_markdown(topic, settings, image_rewrites);
        if (
          settings.save_strategy === "merge" &&
          (await vault_file_exists(vault_path, settings))
        ) {
          markdown = merge_markdown_by_floor(
            await get_vault_file_text(vault_path, settings),
            markdown,
          );
        }
      }
      set_save_button_state("正在写入…", true);
      await save_with_rest_api(markdown, vault_path, settings);
      show_toast(`已保存到 Obsidian：${vault_path}`, "success", 6000);
    } catch (error) {
      show_toast(format_error(error), "error", 12000, {
        label: "重试",
        handler: save_current_topic,
      });
    } finally {
      is_saving = false;
      set_save_button_state("保存到 Obsidian", false);
    }
  }

  function create_actions() {
    if (document.getElementById("ldo-obsidian-actions")) {
      return;
    }
    const actions = document.createElement("div");
    actions.id = "ldo-obsidian-actions";
    actions.title = "按住按钮组拖动位置";
    actions.innerHTML = `
<button id="ldo-obsidian-save" class="ldo-obsidian-button" type="button">
  保存到 Obsidian
</button>
<button
  class="ldo-obsidian-button ldo-obsidian-settings-button"
  type="button"
  title="设置 Obsidian 连接"
  aria-label="设置 Obsidian 连接"
>
  ⚙
</button>
    `;
    actions
      .querySelector("#ldo-obsidian-save")
      .addEventListener("click", save_current_topic);
    actions
      .querySelector(".ldo-obsidian-settings-button")
      .addEventListener("click", show_settings);
    document.body.append(actions);
    restore_actions_position(actions);
    bind_actions_drag(actions);
  }

  function clamp_actions_position(left, top, rect) {
    const margin = 12;
    const max_left = Math.max(margin, window.innerWidth - rect.width - margin);
    const max_top = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(max_left, Math.max(margin, left)),
      top: Math.min(max_top, Math.max(margin, top)),
    };
  }

  function set_actions_position(actions, left, top) {
    const position = clamp_actions_position(
      left,
      top,
      actions.getBoundingClientRect(),
    );
    actions.style.left = `${position.left}px`;
    actions.style.top = `${position.top}px`;
    actions.style.right = "auto";
    actions.style.bottom = "auto";
    return position;
  }

  async function restore_actions_position(actions) {
    try {
      const position = await GM.getValue(ACTIONS_POSITION_KEY, null);
      if (
        position &&
        Number.isFinite(Number(position.left)) &&
        Number.isFinite(Number(position.top))
      ) {
        set_actions_position(
          actions,
          Number(position.left),
          Number(position.top),
        );
      }
    } catch (error) {
      console.warn("linux.do 操作按钮位置恢复失败：", error);
    }
  }

  function bind_actions_drag(actions) {
    let drag_state = null;
    let suppress_click = false;

    actions.addEventListener(
      "click",
      (event) => {
        if (!suppress_click) {
          return;
        }
        suppress_click = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );

    actions.addEventListener("pointerdown", (event) => {
      if (drag_state || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }
      const rect = actions.getBoundingClientRect();
      drag_state = {
        pointer_id: event.pointerId,
        start_x: event.clientX,
        start_y: event.clientY,
        offset_x: event.clientX - rect.left,
        offset_y: event.clientY - rect.top,
        moved: false,
        position: null,
      };
    });

    window.addEventListener("pointermove", (event) => {
      if (!drag_state || event.pointerId !== drag_state.pointer_id) {
        return;
      }
      const distance = Math.hypot(
        event.clientX - drag_state.start_x,
        event.clientY - drag_state.start_y,
      );
      if (!drag_state.moved && distance < 4) {
        return;
      }
      drag_state.moved = true;
      actions.classList.add("is-dragging");
      drag_state.position = set_actions_position(
        actions,
        event.clientX - drag_state.offset_x,
        event.clientY - drag_state.offset_y,
      );
      event.preventDefault();
    });

    const finish_drag = (event) => {
      if (!drag_state || event.pointerId !== drag_state.pointer_id) {
        return;
      }
      if (drag_state.moved) {
        suppress_click = true;
        event.preventDefault();
        void GM.setValue(ACTIONS_POSITION_KEY, drag_state.position).catch(
          (error) => {
            console.warn("linux.do 操作按钮位置保存失败：", error);
          },
        );
        window.setTimeout(() => {
          suppress_click = false;
        }, 0);
      }
      actions.classList.remove("is-dragging");
      drag_state = null;
    };
    window.addEventListener("pointerup", finish_drag);
    window.addEventListener("pointercancel", finish_drag);
  }

  function matches_shortcut(event, shortcut) {
    const parts = String(shortcut || "")
      .toLowerCase()
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      return false;
    }
    const key = parts.find(
      (part) =>
        !["mod", "ctrl", "control", "meta", "cmd", "shift", "alt"].includes(
          part,
        ),
    );
    const wants_mod = parts.includes("mod");
    const wants_ctrl = parts.includes("ctrl") || parts.includes("control");
    const wants_meta = parts.includes("meta") || parts.includes("cmd");
    const wants_shift = parts.includes("shift");
    const wants_alt = parts.includes("alt");
    const actual_key = event.key.toLowerCase();
    return (
      actual_key === key &&
      (!wants_mod || event.metaKey || event.ctrlKey) &&
      (!wants_ctrl || event.ctrlKey) &&
      (!wants_meta || event.metaKey) &&
      event.shiftKey === wants_shift &&
      event.altKey === wants_alt
    );
  }

  function bind_shortcut() {
    document.addEventListener("keydown", async (event) => {
      const target = event.target;
      if (
        target?.closest?.("#ldo-obsidian-modal") ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) ||
        target?.isContentEditable
      ) {
        return;
      }
      const settings = await load_settings();
      if (
        !settings.enable_shortcut ||
        !matches_shortcut(event, settings.shortcut)
      ) {
        return;
      }
      event.preventDefault();
      save_current_topic();
    });
  }

  function sync_actions_visibility() {
    const actions = document.getElementById("ldo-obsidian-actions");
    if (actions) {
      actions.hidden = !get_topic_id();
    }
  }

  create_actions();
  bind_shortcut();
  sync_actions_visibility();
  window.setInterval(sync_actions_visibility, 1000);
})();
