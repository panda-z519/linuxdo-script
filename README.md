# Linuxdo 脚本

把 linux.do 主题帖保存为 Obsidian Markdown 笔记的浏览器 Userscript。脚本通过 Obsidian 社区插件 **Local REST API** 写入 Vault，支持保存主帖、评论、图片附件和分类目录。

## 主要功能

- 一键保存 linux.do 主题帖，不需要手动滚动加载全部评论。
- 支持保存全部楼层、只保存主帖、主帖加楼主回复。
- 支持楼层范围过滤，例如 `1-20,35,50-`。
- 支持最低点赞过滤，主帖始终保留。
- 支持主帖图片和评论图片分别控制。
- 支持下载图片到 Obsidian 附件目录，并按分类目录自动区分。
- 支持分类映射，把 linux.do 分类保存到自己的 Obsidian 目录。
- 支持重复保存策略：覆盖、合并新增楼层、跳过、生成时间戳新文件。
- 支持保存前大窗口预览，预览框可拖拽调整大小。
- 右下角操作按钮组可以拖动，位置会保存在脚本存储中。
- 支持快捷键保存。

## 安装

1. 安装浏览器脚本管理器：
   - Chrome / Edge / Firefox：Tampermonkey
   - Safari：Userscripts 或 Tampermonkey
2. 新建脚本，把 `linux.do 帖子保存到 Obsidian.user.js` 的内容粘贴进去。
3. 保存并启用脚本。
4. 打开 linux.do 主题页，会出现“保存到 Obsidian”按钮和设置按钮；可以按住按钮组拖动到合适位置。

也可以直接打开 [GitHub Raw 脚本文件](https://raw.githubusercontent.com/panda-z519/linuxdo-script/main/linux.do%20%E5%B8%96%E5%AD%90%E4%BF%9D%E5%AD%98%E5%88%B0%20Obsidian.user.js)，由脚本管理器安装或更新。

## Obsidian 配置

1. 在 Obsidian 中安装社区插件 `Local REST API`。
2. 启用插件里的 HTTP 服务。
3. 复制插件设置里的 API Key。
4. 打开脚本设置，填写：
   - `Local REST API 地址`：默认 `http://127.0.0.1:27123`
   - `API Key`：粘贴 Local REST API 的 Key
5. 点击“测试服务”，显示“服务可以连接。”后保存设置。

API Key 可以直接粘贴这些格式，脚本会自动提取真正的 Key：

```text
abc123
Bearer abc123
Authorization: Bearer abc123
```

## 保存路径

默认笔记基础目录是：

```text
LinuxDo
```

脚本会自动追加分类目录。比如帖子分类是 `开发调优`，笔记会保存到：

```text
LinuxDo/开发调优/{id}-{title}.md
```

如果配置分类映射：

```text
开发调优=技术/LinuxDo
资源荟萃=资料/LinuxDo
```

那么 `开发调优` 分类会保存到：

```text
LinuxDo/技术/LinuxDo/{id}-{title}.md
```

## 附件路径

默认附件目录是：

```text
附件/linuxdo
```

开启“下载图片到附件目录”后，附件也会追加分类映射后的目录。例如分类映射为 `开发调优=技术/LinuxDo` 时，图片会保存到：

```text
附件/linuxdo/技术/LinuxDo/{topic_id}-{floor}-{index}.ext
```

Markdown 里的图片链接会自动替换成本地附件路径。图片下载失败不会中断保存，脚本会保留原始远程图片链接。

## 常用设置

### 文件名模板

默认模板：

```text
{id}-{title}
```

可用变量：

- `{id}`：主题 ID
- `{title}`：主题标题
- `{category}`：分类名，使用分类映射后的值
- `{date}`：主题创建日期
- `{slug}`：主题 slug
- `{timestamp}`：当前时间戳

### 重复保存策略

- `覆盖同名笔记`：直接覆盖已有文件。
- `合并新增楼层`：读取已有笔记，只追加新楼层。
- `已有同名笔记时跳过`：文件存在时不写入。
- `生成带时间戳的新笔记`：每次保存一个新文件。

### 帖子范围

- `全部楼层`：保存主帖和所有可见评论。
- `主帖 + 楼主回复`：只保存主帖作者的内容。
- `只保存主帖`：只保存 1 楼。

### 楼层范围

留空表示不过滤。示例：

```text
1-20,35,50-
```

含义是保存 1 到 20 楼、第 35 楼、以及 50 楼之后的内容。

### 保存前预览

开启后，脚本会先弹出渲染后的 Markdown 预览。预览窗口默认较宽，只显示最终效果，不显示源码对比；窗口右下角可拖拽调整大小。

### 快捷键

开启“启用快捷键保存”后可使用快捷键保存。默认：

```text
mod+shift+s
```

`mod` 在 macOS 上表示 `Command`，在 Windows/Linux 上表示 `Ctrl`。

## 常见问题

### HTTP 401

通常是 API Key 不正确或已经变更。

处理方式：

1. 打开 Obsidian 的 Local REST API 插件设置。
2. 重新复制 API Key。
3. 粘贴到脚本设置里。
4. 点击“测试服务”。

### HTTP 0

HTTP 0 表示脚本没有拿到真正的 HTTP 响应，常见原因是：

- Obsidian 没有运行。
- Local REST API 插件没有启用。
- HTTP 服务没有启用。
- 地址或端口填错。
- 浏览器或脚本管理器没有放行本机连接权限。
- HTTPS 页面请求 HTTP 本机服务时被浏览器拦截。

建议先在浏览器地址栏打开：

```text
http://127.0.0.1:27123
```

确认服务能访问后，再回脚本里测试。

### 看不到按钮

- 确认脚本已启用。
- 刷新 linux.do 页面。
- 确认当前页面是主题页。
- Safari Userscripts 需要点一次 `Refresh view`。

## 开发

本项目是单文件 Userscript，没有构建步骤。

```sh
npm run check
```

检查脚本语法。

```sh
npm run format
```

使用 Prettier 格式化脚本、README 和 `package.json`。

## 权限说明

脚本需要这些权限：

- `GM.getValue` / `GM.setValue`：保存脚本设置。
- `GM.xmlHttpRequest`：访问 Obsidian Local REST API 和下载图片。
- `@connect 127.0.0.1` / `@connect localhost`：连接本机 Obsidian 服务。
- `@connect *`：下载帖子图片，图片可能来自 linux.do CDN 或外部图床。

脚本不会修改 linux.do 上的内容，也不会把 API Key 发送到 linux.do。
