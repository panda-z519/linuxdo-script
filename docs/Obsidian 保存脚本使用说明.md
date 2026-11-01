# Obsidian 保存脚本使用说明

本文说明仓库中已经存在的 [linux.do 帖子保存到 Obsidian.user.js](<../userscripts/save-obsidian/linux.do 帖子保存到 Obsidian.user.js>)。它将 linux.do 主题帖保存为 Obsidian Markdown（标记语言）笔记，并通过 Obsidian 社区插件 Local REST API（本地 REST 接口）写入 Vault（笔记库）。

## 能力与边界

- 一键保存主题主帖和评论；无需手动滚动加载全部评论。
- 可选择保存全部楼层、主帖加楼主回复或仅主帖。
- 支持楼层范围、最低点赞数、图片范围、分类目录和文件名模板。
- 支持覆盖、合并新增楼层、跳过同名文件和带时间戳新建文件。
- 可选保存前预览、图片下载到本地附件目录、快捷键保存，以及右下角按钮组拖拽定位。
- 脚本不会修改 linux.do 内容，也不会把 API Key（接口密钥）发送给 linux.do。

## 安装

1. 安装浏览器用户脚本管理器：Chrome、Edge、Firefox 可使用 Tampermonkey；Safari 可使用 Userscripts 或 Tampermonkey。
2. 新建用户脚本，将 [`linux.do 帖子保存到 Obsidian.user.js`](<../userscripts/save-obsidian/linux.do 帖子保存到 Obsidian.user.js>) 的全部内容粘贴进去并启用。
3. 打开 linux.do 主题页。右下角会显示“保存到 Obsidian”和设置按钮；可按住按钮组拖动位置。

脚本头部声明了 `@updateURL` / `@downloadURL`，安装后脚本管理器会按这个地址自动检查更新；请从下面的正式地址安装，手动粘贴到别处的副本不会自动更新。

也可打开 [GitHub Raw 脚本文件](https://raw.githubusercontent.com/panda-z519/linuxdo-script/main/userscripts/save-obsidian/linux.do%20%E5%B8%96%E5%AD%90%E4%BF%9D%E5%AD%98%E5%88%B0%20Obsidian.user.js)，由脚本管理器安装或更新。

也可以从 Greasy Fork 直接安装：<https://greasyfork.org/zh-CN/scripts/587200>。

已发布的历史版本按版本号归档在 [`versions/save-obsidian/`](../versions/README.md)，需要回滚时复制对应版本文件的全部内容替换当前脚本。

## 配置 Obsidian

1. 在 Obsidian 中安装并启用社区插件 `Local REST API`，再启用它的 HTTP 服务。
2. 复制插件设置中的 API Key。
3. 打开脚本设置，填写 Local REST API 地址（默认 `http://127.0.0.1:27123`）和 API Key。
4. 点击“测试服务”；出现“服务可以连接。”后保存设置。

API Key 可直接粘贴为下列任意形式，脚本会提取实际密钥：

```text
abc123
Bearer abc123
Authorization: Bearer abc123
```

## 保存规则

### 笔记与分类路径

默认基础目录：

```text
LinuxDo
```

脚本会自动附加主题分类。例如“开发调优”会保存为：

```text
LinuxDo/开发调优/{id}-{title}.md
```

分类映射示例：

```text
开发调优=技术/LinuxDo
资源荟萃=资料/LinuxDo
```

映射后，“开发调优”主题会保存到：

```text
LinuxDo/技术/LinuxDo/{id}-{title}.md
```

### 图片附件路径

默认附件目录：

```text
附件/linuxdo
```

启用“下载图片到附件目录”后，图片会在附件目录下追加分类映射路径。例如映射为 `开发调优=技术/LinuxDo` 时，图片路径类似：

```text
附件/linuxdo/技术/LinuxDo/{topic_id}-{floor}-{index}.ext
```

图片下载失败不会中断笔记保存，Markdown 会保留远程图片链接。

### 文件名模板

默认模板：

```text
{id}-{title}
```

可用变量：

- `{id}`：主题 ID。
- `{title}`：主题标题。
- `{category}`：映射后的分类名。
- `{date}`：主题创建日期。
- `{slug}`：主题 slug。
- `{timestamp}`：当前时间戳。

### 保存策略

| 策略                 | 行为                         |
| -------------------- | ---------------------------- |
| 覆盖同名笔记         | 直接覆盖已有文件。           |
| 合并新增楼层         | 读取已有笔记，只追加新楼层。 |
| 已有同名笔记时跳过   | 文件存在时不写入。           |
| 生成带时间戳的新笔记 | 每次写入一个新文件。         |

### 帖子范围与过滤

- 全部楼层：保存主帖和所有可见评论。
- 主帖 + 楼主回复：仅保存主帖作者的内容。
- 只保存主帖：仅保存 1 楼。
- 楼层范围留空表示不过滤，例如 `1-20,35,50-` 表示保存 1 至 20 楼、第 35 楼和 50 楼之后的内容。
- 最低点赞数只过滤评论，主帖始终保留。

### 预览与快捷键

开启“保存前预览”后，脚本会展示最终 Markdown 的渲染结果；预览框右下角可拖拽调整大小。开启“启用快捷键保存”后，默认使用 `mod+shift+s`；`mod` 在 macOS 表示 Command，在 Windows 和 Linux 表示 Ctrl。

## 故障排查

### HTTP 401

通常是 API Key 不正确或已变更。请在 Obsidian Local REST API 设置中重新复制 Key，粘贴回脚本设置后点击“测试服务”。

### HTTP 0

表示脚本没有拿到 HTTP 响应，常见原因包括：

- Obsidian 未运行，或 Local REST API 插件及 HTTP 服务未启用。
- 地址、端口错误；可先在浏览器打开 `http://127.0.0.1:27123`。
- 浏览器或脚本管理器未放行本机连接。
- HTTPS 页面访问 HTTP 本机服务被浏览器拦截。
- 如果使用 HTTPS，需要先信任 Local REST API 的自签名证书。

### 看不到右下角按钮

- 确认脚本已启用，并刷新 linux.do 主题页。
- 确认当前地址是主题页而非列表页。
- 0.9.6 及更早版本在按钮隐藏（列表页加载）时读取尺寸，会把记住的拖动位置算到视口角落，进入帖子页后按钮有一大半落在视口外，看起来就是“按钮没出来”。0.9.7 起按真实尺寸计算，并在按钮显示和窗口尺寸变化时把位置夹回视口。
- 与弹框阅读脚本共存时，保存按钮组、设置弹窗和提示固定使用 `2147483000` 以上的层级，始终显示在阅读弹框（遮罩 `2147482998`、外壳 `2147482999`）之上。若在弹框里看不到按钮，说明保存脚本仍是 0.9.5 及更早版本，请更新脚本。
- 其他全屏遮罩类脚本或浏览器扩展的层级也可能高于保存按钮组，可临时停用它们排查。
- Safari 的 Userscripts 需先启用扩展并执行 `Refresh view`；若 Web Inspector（网页检查器）显示 `Userscripts off`，还需通过扩展工具栏的 `Toggle injection` 打开全局注入后刷新页面。

## 权限说明

- `GM.getValue`、`GM.setValue`：保存脚本设置和按钮位置。
- `GM.xmlHttpRequest`：访问本机 Obsidian 接口及下载主题图片。
- `@connect 127.0.0.1`、`@connect localhost`：访问本机 Obsidian 服务。
- `@connect *`：下载可能来自 linux.do CDN（内容分发网络）或外部图床的图片。

## 开发检查

在仓库根目录执行：

```sh
npm run check
```

该命令检查脚本 JavaScript（JavaScript）语法。变更保存行为后，还应使用真实 linux.do 主题页及本机 Obsidian Vault 手动验证保存范围、图片、预览、重复保存策略和错误提示。
