# 版本归档

这里按版本保存已发布的用户脚本快照，用来回滚和对比。

## 目录约定

```text
versions/<脚本目录>/<版本号>/<脚本文件名>
```

- `<脚本目录>` 与 [`userscripts/`](../userscripts/README.md) 下的目录同名。
- `<版本号>` 必须等于该文件 `// @version` 的值。
- 每个版本目录只放一个 `.user.js`，内容与发布时 `userscripts/` 下的文件完全一致。

当前归档：

| 脚本            | 版本    | 文件                                                                                               |
| --------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `save-obsidian` | `0.9.8` | [linux.do 帖子保存到 Obsidian.user.js](<save-obsidian/0.9.8/linux.do 帖子保存到 Obsidian.user.js>) |
| `save-obsidian` | `0.9.7` | [linux.do 帖子保存到 Obsidian.user.js](<save-obsidian/0.9.7/linux.do 帖子保存到 Obsidian.user.js>) |
| `save-obsidian` | `0.9.6` | [linux.do 帖子保存到 Obsidian.user.js](<save-obsidian/0.9.6/linux.do 帖子保存到 Obsidian.user.js>) |
| `topic-reader`  | `5.0.7` | [linux.do 帖子弹框阅读.user.js](<topic-reader/5.0.7/linux.do 帖子弹框阅读.user.js>)                |
| `topic-reader`  | `5.0.6` | [linux.do 帖子弹框阅读.user.js](<topic-reader/5.0.6/linux.do 帖子弹框阅读.user.js>)                |

## 生成与使用

- 新增归档：运行 `npm run archive-version`（脚本在 [`tools/archive-version.js`](../tools/archive-version.js)）。它读取每个当前脚本的 `@version`，复制到对应目录。
- 已存在的归档默认不可覆盖：同一版本号有内容差异时会报错，确认要覆盖需加 `--force`。这也提醒你发布新内容前先提升 `@version`。
- 回滚：打开对应版本的文件，复制全部内容，粘贴到脚本管理器中替换现有脚本。
- 一致性检查：`npm test` 中的 [`tests/versions.test.js`](../tests/versions.test.js) 校验目录名与 `@version` 对应、归档版本不高于当前版本、归档内容与当前脚本一致。
