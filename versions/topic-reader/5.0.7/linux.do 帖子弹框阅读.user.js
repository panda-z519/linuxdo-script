// ==UserScript==
// @name         linux.do 帖子弹框阅读
// @namespace    https://linux.do/
// @version      5.0.7
// @updateURL    https://raw.githubusercontent.com/panda-z519/linuxdo-script/main/userscripts/topic-reader/linux.do%20%E5%B8%96%E5%AD%90%E5%BC%B9%E6%A1%86%E9%98%85%E8%AF%BB.user.js
// @downloadURL  https://raw.githubusercontent.com/panda-z519/linuxdo-script/main/userscripts/topic-reader/linux.do%20%E5%B8%96%E5%AD%90%E5%BC%B9%E6%A1%86%E9%98%85%E8%AF%BB.user.js
// @author       zsq
// @license      MIT
// @description  复用 linux.do 原生路由，在当前页面弹框阅读帖子
// @match        *://linux.do/*
// @match        *://www.linux.do/*
// @run-at       document-idle
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

(function (root) {
  "use strict";

  var ALLOWED_HOSTS = ["linux.do", "www.linux.do"];
  var READER_VERSION = "5.0.6";

  function parse_topic_url(value, current_url) {
    var url;
    var current;
    try {
      url = new URL(value, current_url);
      current = new URL(current_url);
    } catch (_error) {
      return null;
    }
    if (
      url.origin !== current.origin ||
      ALLOWED_HOSTS.indexOf(url.hostname.toLowerCase()) === -1
    ) {
      return null;
    }
    var parts = url.pathname.split("/").filter(function (part) {
      return part.length > 0;
    });
    if (parts[0] !== "t") {
      return null;
    }
    var topic_id = /^\d+$/.test(parts[1] || "")
      ? parts[1]
      : /^\d+$/.test(parts[2] || "")
        ? parts[2]
        : null;
    return topic_id ? { topic_id: topic_id, url: url.href } : null;
  }

  function should_intercept_click(event) {
    return !(
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  function get_safe_url(value, current_url, allowed_protocols) {
    try {
      var url = new URL(value, current_url);
      return allowed_protocols.indexOf(url.protocol) === -1 ? null : url.href;
    } catch (_error) {
      return null;
    }
  }

  function build_reader_state(topic_value, current_url) {
    var topic = parse_topic_url(topic_value, current_url);
    if (!topic) {
      return null;
    }
    var topic_url = new URL(topic.url);
    var parts = topic_url.pathname.split("/").filter(function (part) {
      return part.length > 0;
    });
    topic_url.pathname = /^\d+$/.test(parts[1] || "")
      ? "/t/" + topic.topic_id
      : "/t/" + parts[1] + "/" + topic.topic_id;
    topic_url.search = "";
    topic_url.hash = "";
    return { source_url: current_url, topic_url: topic_url.href };
  }

  function calculate_topic_body_width(container_width) {
    // 预留主内容边距、楼层时间线、头像和 Discourse 原生帖子间距。
    return Math.max(320, Math.floor(container_width - 229));
  }

  var public_api = {
    parse_topic_url: parse_topic_url,
    should_intercept_click: should_intercept_click,
    get_safe_url: get_safe_url,
    build_reader_state: build_reader_state,
    calculate_topic_body_width: calculate_topic_body_width,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = public_api;
  }
  if (!root || !root.document) {
    return;
  }

  var document = root.document;
  var ACTIVE_CLASS = "ldo-topic-reader-active";
  var CHROME_ID = "ldo-topic-reader-chrome";
  var STYLE_ID = "ldo-topic-reader-style";
  var reader = null;
  var title_timer = null;
  var close_timer = null;
  var fallback_timer = null;

  var css = `
body.${ACTIVE_CLASS}{overflow:hidden!important}
#ldo-topic-reader-backdrop{position:fixed;inset:0;z-index:2147482998;background:rgba(43,36,72,.10);animation:reader-backdrop-in 200ms ease-out both}
#${CHROME_ID}.reader-dialog-shell{position:fixed;top:50%;left:50%;z-index:2147482999;display:flex;width:min(1480px,calc(100vw - 32px));height:min(92vh,980px);flex-direction:column;overflow:hidden;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.78);border-radius:20px;color:var(--primary,#272433);background:rgba(255,255,255,.94);box-shadow:0 24px 70px rgba(42,35,78,.18);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:reader-dialog-in 200ms ease-out both}
#${CHROME_ID} .reader-header{display:flex;min-height:58px;flex:0 0 auto;align-items:center;gap:12px;padding:8px 10px 8px 18px;border-bottom:1px solid rgba(80,72,116,.14);background:rgba(255,255,255,.76)}
#${CHROME_ID} .reader-mark{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:var(--tertiary,#6557d8);box-shadow:0 0 0 4px var(--tertiary-very-low,#f0edff)}
#${CHROME_ID} .reader-title{min-width:0;flex:1;margin:0;overflow:hidden;color:var(--primary,#272433);font-size:14px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}
#${CHROME_ID} button{display:inline-flex;width:42px;height:42px;align-items:center;justify-content:center;border:0;border-radius:11px;color:var(--primary-high,#575164);background:transparent;cursor:pointer;transition:color 160ms ease,background-color 160ms ease}
#${CHROME_ID} button:hover{color:var(--tertiary,#6557d8);background:var(--tertiary-very-low,#f0edff)}
#${CHROME_ID} button:focus-visible{outline:3px solid rgba(101,87,216,.34);outline-offset:1px}
#${CHROME_ID} svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#${CHROME_ID} .reader-content-slot{min-height:0;flex:1;overflow:auto;background:rgba(255,255,255,.98)}
#${CHROME_ID} #main-outlet-wrapper{position:static!important;display:grid!important;width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:100%!important;margin:0!important;overflow:visible!important;grid-template-columns:minmax(0,1fr)!important;background:transparent!important;box-shadow:none!important}
#${CHROME_ID} .sidebar-wrapper,#${CHROME_ID} .sidebar-container,#${CHROME_ID} #d-sidebar,#${CHROME_ID} .d-header .header-sidebar-toggle{display:none!important}
#${CHROME_ID} #main-outlet{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding-right:24px!important;padding-left:24px!important}
#${CHROME_ID} .container.posts{width:100%!important;max-width:100%!important;grid-template-areas:"posts timeline"!important;grid-template-columns:minmax(0,1fr) 96px!important}
#${CHROME_ID} .container.posts>.row{max-width:100%!important;min-width:0!important;width:100%!important}
#${CHROME_ID} .topic-area,#${CHROME_ID} .posts-wrapper,#${CHROME_ID} .post-stream,#${CHROME_ID} .topic-body,#${CHROME_ID} .cooked{min-width:0!important;max-width:100%!important}
#${CHROME_ID} .topic-post>.row{display:flex!important;width:100%!important}
#${CHROME_ID} .cooked img,#${CHROME_ID} .cooked video,#${CHROME_ID} .cooked table{max-width:100%!important}
#${CHROME_ID} .container.posts .topic-navigation{position:sticky!important;right:auto!important;width:96px!important;min-width:96px!important;margin-left:0!important}
#ldo-topic-reader-background-snapshot{box-sizing:border-box;width:100%;display:grid;grid-template-areas:"sidebar content";grid-template-columns:var(--d-sidebar-width,220px) minmax(0,1fr);gap:0 var(--d-main-content-gap,24px);pointer-events:none}
#ldo-topic-reader-background-snapshot .ldo-reader-snapshot-main{grid-area:content;min-width:0;padding:var(--main-outlet-padding-top,24px) var(--main-outlet-padding-x,24px) var(--main-outlet-padding-bottom,40px)}
#ldo-topic-reader-background-snapshot .sidebar-wrapper{grid-area:sidebar}
body.${ACTIVE_CLASS} .composer-container,body.${ACTIVE_CLASS} #reply-control,body.${ACTIVE_CLASS} .user-card,body.${ACTIVE_CLASS} .card-container,body.${ACTIVE_CLASS} .modal-container,body.${ACTIVE_CLASS} .dialog-holder{z-index:2147483005!important}
#${CHROME_ID}.reader-closing{animation:reader-dialog-out 150ms ease-in both}#ldo-topic-reader-backdrop.reader-closing{animation:reader-backdrop-out 150ms ease-in both}
@keyframes reader-dialog-in{from{opacity:0;transform:translate(-50%,-50%) scale(.98)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes reader-dialog-out{from{opacity:1;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-50%) scale(.985)}}
@keyframes reader-backdrop-in{from{opacity:0}to{opacity:1}}@keyframes reader-backdrop-out{from{opacity:1}to{opacity:0}}
@media(max-width:700px){#${CHROME_ID}.reader-dialog-shell{width:calc(100vw - 16px);height:calc(100dvh - 16px);border-radius:16px}#${CHROME_ID} .reader-header{min-height:54px;padding-left:14px}#${CHROME_ID} button{width:44px;height:44px}#${CHROME_ID} #main-outlet{width:100%!important;max-width:none!important;padding-right:14px!important;padding-left:14px!important}#${CHROME_ID} .container.posts{grid-template-areas:"posts"!important;grid-template-columns:minmax(0,1fr)!important}#${CHROME_ID} .container.posts .topic-navigation{display:none!important}}
@media(prefers-color-scheme:dark){#${CHROME_ID}.reader-dialog-shell{border-color:rgba(255,255,255,.12);background:rgba(30,39,51,.9)}#${CHROME_ID} .reader-header{border-color:rgba(255,255,255,.1);background:rgba(30,39,51,.8)}#${CHROME_ID} .reader-content-slot{background:rgba(20,26,35,.96)}}
@media(prefers-reduced-motion:reduce){#${CHROME_ID}.reader-dialog-shell,#${CHROME_ID}.reader-closing,#ldo-topic-reader-backdrop,#ldo-topic-reader-backdrop.reader-closing{animation:none}#${CHROME_ID} button{transition:none}}
  `;

  function start() {
    if (!document.head || !document.body) {
      root.setTimeout(start, 50);
      return;
    }
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = css;
      document.head.appendChild(style);
    }
    document.addEventListener("click", handle_click, true);
    root.addEventListener("popstate", handle_route_change);
    root.console.info("[LinuxDo Reader] v" + READER_VERSION + " loaded");
  }

  function find_anchor(node) {
    var current =
      node && node.nodeType === 1 ? node : node && node.parentElement;
    while (current && current !== document.documentElement) {
      if (current.tagName === "A") {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function handle_click(event) {
    if (!should_intercept_click(event) || reader) {
      return;
    }
    var anchor = find_anchor(event.target);
    if (
      !anchor ||
      anchor.hasAttribute("target") ||
      anchor.hasAttribute("download") ||
      anchor.hasAttribute("data-no-topic-reader")
    ) {
      return;
    }
    var next_reader = build_reader_state(anchor.href, root.location.href);
    if (!next_reader) {
      return;
    }
    var main_outlet = document.querySelector("#main-outlet-wrapper");
    if (!main_outlet) {
      return;
    }
    reader = next_reader;
    reader.source_scroll_y = root.scrollY;
    reader.trigger = anchor;
    reader.background_snapshot = create_background_snapshot(main_outlet);
    var original_href = anchor.getAttribute("href");
    anchor.href = next_reader.topic_url;
    root.setTimeout(activate_reader_mode, 0);
    root.setTimeout(function () {
      if (!anchor.isConnected) {
        return;
      }
      if (original_href === null) {
        anchor.removeAttribute("href");
      } else {
        anchor.setAttribute("href", original_href);
      }
    }, 0);
    // 不阻止点击，继续交给 Discourse 已加载的原生路由处理。
  }

  function create_background_snapshot(main_outlet) {
    var snapshot = main_outlet.cloneNode(true);
    snapshot.id = "ldo-topic-reader-background-snapshot";
    snapshot.setAttribute("aria-hidden", "true");
    snapshot.setAttribute("inert", "");
    Array.prototype.slice
      .call(snapshot.querySelectorAll("[id]"))
      .forEach(function (element) {
        if (element.id === "main-outlet") {
          element.classList.add("ldo-reader-snapshot-main");
        }
        element.removeAttribute("id");
      });
    Array.prototype.slice
      .call(snapshot.querySelectorAll("a,button,input"))
      .forEach(function (element) {
        element.setAttribute("tabindex", "-1");
      });
    return snapshot;
  }

  function activate_reader_mode() {
    if (!reader) {
      return;
    }
    var main_outlet = document.querySelector("#main-outlet-wrapper");
    if (!main_outlet || !main_outlet.parentNode) {
      reader = null;
      return;
    }
    reader.main_outlet = main_outlet;
    reader.main_parent = main_outlet.parentNode;
    reader.main_next = main_outlet.nextSibling;
    document.body.classList.add(ACTIVE_CLASS);
    var backdrop = document.createElement("div");
    backdrop.id = "ldo-topic-reader-backdrop";
    var chrome = document.createElement("div");
    chrome.id = CHROME_ID;
    chrome.className = "reader-dialog-shell";
    chrome.dataset.readerVersion = READER_VERSION;
    chrome.setAttribute("role", "dialog");
    chrome.setAttribute("aria-modal", "true");
    chrome.setAttribute("aria-labelledby", "ldo-topic-reader-title");
    chrome.innerHTML = `
<header class="reader-header">
<span class="reader-mark" aria-hidden="true"></span>
<p class="reader-title" id="ldo-topic-reader-title">正在打开原生帖子…</p>
<button class="reader-normal" type="button" aria-label="展开为普通页面">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
</button>
<button class="reader-close" type="button" aria-label="关闭并返回列表">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
</button>
</header>
<div class="reader-content-slot"></div>`;
    document.body.appendChild(backdrop);
    document.body.appendChild(chrome);
    var content_slot = chrome.querySelector(".reader-content-slot");
    reader.chrome = chrome;
    reader.content_slot = content_slot;
    content_slot.appendChild(main_outlet);
    if (
      reader.main_next &&
      reader.main_next.parentNode === reader.main_parent
    ) {
      reader.main_parent.insertBefore(
        reader.background_snapshot,
        reader.main_next,
      );
    } else {
      reader.main_parent.appendChild(reader.background_snapshot);
    }
    backdrop.addEventListener("click", function () {
      return_to_source();
    });
    chrome
      .querySelector(".reader-close")
      .addEventListener("click", return_to_source);
    chrome
      .querySelector(".reader-normal")
      .addEventListener("click", function () {
        finish_reader(false);
      });
    document.addEventListener("keydown", handle_keydown);
    reader.resize_handler = sync_topic_body_width;
    root.addEventListener("resize", reader.resize_handler);
    sync_topic_body_width();
    title_timer = root.setInterval(update_reader_title, 200);
    update_reader_title();
    chrome.querySelector(".reader-close").focus();
  }

  function handle_keydown(event) {
    if (
      event.key === "Escape" &&
      reader &&
      !event.defaultPrevented &&
      !has_native_overlay()
    ) {
      event.preventDefault();
      return_to_source();
    }
  }

  function has_native_overlay() {
    var elements = document.querySelectorAll(
      "#reply-control.open, body.composer-open, .modal-container, .dialog-holder .dialog, .user-card.show",
    );
    return Array.prototype.slice.call(elements).some(function (element) {
      return element === document.body || element.getClientRects().length > 0;
    });
  }

  function sync_topic_body_width() {
    if (!reader || !reader.chrome || !reader.content_slot) {
      return;
    }
    if (root.innerWidth <= 700) {
      reader.chrome.style.removeProperty("--topic-body-width");
      reader.last_content_width = null;
      return;
    }
    var content_width = reader.content_slot.clientWidth;
    if (!content_width || content_width === reader.last_content_width) {
      return;
    }
    reader.last_content_width = content_width;
    reader.chrome.style.setProperty(
      "--topic-body-width",
      calculate_topic_body_width(content_width) + "px",
    );
  }

  function update_reader_title() {
    var chrome = document.getElementById(CHROME_ID);
    if (!chrome) {
      return;
    }
    var scope = reader && reader.main_outlet ? reader.main_outlet : document;
    var heading = scope.querySelector("#topic-title h1, .fancy-title, h1");
    var text = heading ? heading.textContent.trim() : document.title;
    chrome.querySelector(".reader-title").textContent = text || "linux.do 帖子";
    if (heading && reader && !reader.content_ready) {
      var current_topic = parse_topic_url(
        root.location.href,
        root.location.href,
      );
      var target_topic = parse_topic_url(reader.topic_url, root.location.href);
      if (
        current_topic &&
        target_topic &&
        current_topic.topic_id === target_topic.topic_id
      ) {
        reader.content_ready = true;
        reader.content_slot.scrollTop = 0;
      }
    }
  }

  function return_to_source() {
    if (!reader || reader.closing) {
      return;
    }
    if (root.location.href === reader.source_url) {
      finish_reader(true);
      return;
    }
    reader.closing = true;
    var chrome = document.getElementById(CHROME_ID);
    var backdrop = document.getElementById("ldo-topic-reader-backdrop");
    if (chrome) {
      chrome.querySelector(".reader-title").textContent = "正在返回原页面…";
      chrome.classList.add("reader-closing");
    }
    if (backdrop) {
      backdrop.classList.add("reader-closing");
    }
    close_timer = root.setTimeout(function () {
      root.history.back();
      fallback_timer = root.setTimeout(function () {
        if (!reader) {
          return;
        }
        if (root.location.href === reader.source_url) {
          finish_reader(true);
        } else {
          root.location.href = reader.source_url;
        }
      }, 1800);
    }, 150);
  }

  function handle_route_change() {
    if (reader && root.location.href === reader.source_url) {
      finish_reader(true);
    }
  }

  function finish_reader(restore_source) {
    if (!reader) {
      return;
    }
    var completed = reader;
    reader = null;
    if (completed.resize_handler) {
      root.removeEventListener("resize", completed.resize_handler);
    }
    restore_main_outlet(completed);
    document.body.classList.remove(ACTIVE_CLASS);
    var chrome = document.getElementById(CHROME_ID);
    if (chrome) {
      chrome.remove();
    }
    var backdrop = document.getElementById("ldo-topic-reader-backdrop");
    if (backdrop) {
      backdrop.remove();
    }
    document.removeEventListener("keydown", handle_keydown);
    if (title_timer) {
      root.clearInterval(title_timer);
      title_timer = null;
    }
    if (close_timer) {
      root.clearTimeout(close_timer);
      close_timer = null;
    }
    if (fallback_timer) {
      root.clearTimeout(fallback_timer);
      fallback_timer = null;
    }
    if (restore_source) {
      root.setTimeout(function () {
        root.scrollTo(0, completed.source_scroll_y || 0);
        if (completed.trigger && completed.trigger.isConnected) {
          completed.trigger.focus({ preventScroll: true });
        }
      }, 0);
    }
  }

  function restore_main_outlet(completed) {
    var main_outlet = completed.main_outlet;
    var parent = completed.main_parent;
    if (
      completed.background_snapshot &&
      completed.background_snapshot.isConnected
    ) {
      completed.background_snapshot.remove();
    }
    if (!main_outlet || !parent || !parent.isConnected) {
      return;
    }
    if (completed.main_next && completed.main_next.parentNode === parent) {
      parent.insertBefore(main_outlet, completed.main_next);
    } else {
      parent.appendChild(main_outlet);
    }
  }

  start();
})(typeof window !== "undefined" ? window : null);
