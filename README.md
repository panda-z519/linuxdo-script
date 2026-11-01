# LinuxDo 用户脚本

这个仓库收录面向 linux.do 的浏览器用户脚本，包含保存主题到 Obsidian 和在弹框中阅读主题的两个独立脚本。

## 脚本状态

当前版本放在 [`userscripts/`](userscripts/README.md)，已发布的历史版本按版本号归档在 [`versions/`](versions/README.md)。

| 脚本                                                                                                     | 版本  | 状态   | 用途                                          |
| -------------------------------------------------------------------------------------------------------- | ----- | ------ | --------------------------------------------- |
| [linux.do 帖子保存到 Obsidian.user.js](<userscripts/save-obsidian/linux.do 帖子保存到 Obsidian.user.js>) | 0.9.8 | 已实现 | 将主题帖、评论和可选图片附件保存到 Obsidian。 |
| [linux.do 帖子弹框阅读.user.js](<userscripts/topic-reader/linux.do 帖子弹框阅读.user.js>)                | 5.0.7 | 已实现 | 复用原生站内路由，以弹框模式查看帖子。        |

## 文档导航

- [文档索引](docs/README.md)
- [Obsidian 保存脚本使用说明](<docs/Obsidian 保存脚本使用说明.md>)
- [帖子弹框阅读脚本使用说明](docs/帖子弹框阅读脚本使用说明.md)

## 快速开始：保存到 Obsidian

1. 安装 Tampermonkey（Chrome、Edge、Firefox）或 Userscripts/Tampermonkey（Safari）。
2. 新建用户脚本，粘贴 [`linux.do 帖子保存到 Obsidian.user.js`](<userscripts/save-obsidian/linux.do 帖子保存到 Obsidian.user.js>) 的内容并启用。
3. 在 Obsidian 启用 `Local REST API` 社区插件及其 HTTP 服务，复制 API Key。
4. 打开 linux.do 主题页，在右下角设置中填写地址和 API Key，再点击“测试服务”。

安装、保存路径、附件、过滤、重复保存策略、预览、快捷键、权限与故障排查请见[完整使用说明](<docs/Obsidian 保存脚本使用说明.md>)。

## 快速开始：弹框阅读

在浏览器脚本管理器中新建脚本，将 [`linux.do 帖子弹框阅读.user.js`](<userscripts/topic-reader/linux.do 帖子弹框阅读.user.js>) 的内容粘贴并启用。浏览 linux.do 列表、搜索或分类页面时，普通左键点击主题链接会由站内原生路由打开帖子，同时主内容区域提升为弹框并隐藏侧边栏；点赞、回复、用户卡、图片预览和楼层导航仍使用 linux.do 自带功能。弹框工具栏提供返回列表、切换普通页面和关闭。

这个脚本不需要 Obsidian 设置或额外跨域权限。交互方式、接口失败处理和安全边界见[使用说明](docs/帖子弹框阅读脚本使用说明.md)。

## 目录结构

```text
userscripts/<脚本>/<脚本名>.user.js   当前版本，同时是安装地址
versions/<脚本>/<版本>/<脚本名>.user.js  已发布版本的只读快照
docs/                                使用说明、UI 设计稿、截图和原型
tests/                               node --test 回归测试
tools/                               仓库维护脚本
.agents/notes/                       决策记录（为什么这样改、放弃了什么）
```

## 版本与回滚

两个脚本各自独立维护版本号，都在文件头的 `// @version` 里。发布流程：

1. 修改脚本并提升 `@version`。
2. 运行 `npm run archive-version`，当前内容会复制到 `versions/<脚本>/<版本>/`。
3. 运行 `npm run check` 和 `npm test`，确认归档与当前脚本一致。

回滚时打开 `versions/` 下对应版本的文件，复制全部内容替换脚本管理器里的当前脚本即可。约定与校验规则见 [`versions/README.md`](versions/README.md)。

## 开发

项目当前没有构建步骤。运行自动回归测试：

```sh
npm test
```

检查两个脚本的 JavaScript 语法：

```sh
npm run check
```

格式化脚本、测试、README、详细文档和 `package.json`：

```sh
npm run format
```

归档当前版本并校验发布地址：

```sh
npm run archive-version
npm run check-published
```

发版步骤（GitHub 主源、Greasy Fork 镜像、回滚方式）见[发布流程](docs/发布流程.md)。

修改脚本后，应在真实 linux.do 页面手动验证相关路径；保存脚本还需在本机 Obsidian Vault 验证写入。`npm test` 覆盖阅读脚本的主题 URL、点击拦截、安全协议和 Safari Userscripts 元数据边界，检查两个脚本的悬浮层与弹框层级约定，并校验 `versions/` 归档与当前版本一致。
