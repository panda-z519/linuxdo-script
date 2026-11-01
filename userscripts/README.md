# 当前脚本

每个子目录存放一个用户脚本的当前版本，一个目录只放一个 `.user.js`。这两个路径同时是安装地址，发布后不要再改名或移动，否则已安装的用户脚本管理器会失去更新目标。

| 脚本目录         | 文件                                                                                         | 当前版本 | 用途                                          |
| ---------------- | -------------------------------------------------------------------------------------------- | -------- | --------------------------------------------- |
| `save-obsidian/` | [linux.do 帖子保存到 Obsidian.user.js](<save-obsidian/linux.do 帖子保存到 Obsidian.user.js>) | 0.9.8    | 通过 Local REST API 把主题帖保存到 Obsidian。 |
| `topic-reader/`  | [linux.do 帖子弹框阅读.user.js](<topic-reader/linux.do 帖子弹框阅读.user.js>)                | 5.0.7    | 在当前页面以弹框阅读主题，复用站点原生路由。  |

两个脚本互相独立，可以只装其中一个。同时安装时，保存按钮会显示在阅读弹框之上。

## 安装

在 Tampermonkey 或 Safari 的 Userscripts 中新建脚本，粘贴对应文件的全部内容并启用。详细步骤见[保存脚本使用说明](<../docs/Obsidian 保存脚本使用说明.md>)和[弹框阅读脚本使用说明](../docs/帖子弹框阅读脚本使用说明.md)。

## 发布新版本

1. 修改脚本，并把 `@version` 提升到新版本号。
2. 运行 `npm run archive-version`，把当前内容归档到 [`versions/<脚本>/<版本>/`](../versions/README.md)。
3. 运行 `npm run check` 和 `npm test`。

不要直接修改 `versions/` 里的文件：它保存的是已发布的快照，`npm test` 会校验它与当前脚本一致。
