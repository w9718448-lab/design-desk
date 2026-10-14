# 设计台 Design Desk

个人品牌设计工作流，本机运行的网页应用：需求 → 创意发散 → 视觉风格 → 出稿 → 评审 → 交付。

- **展示版（可操作，不保存数据）**：https://w9718448-lab.github.io/design-desk/
- **交接说明（给接手的 AI）**：[docs/交接说明.md](docs/交接说明.md)
- **下载安装包**：右侧 Releases 里最新版本的“设计台安装包（Mac 和 Windows 通用）”

## 使用

解压后双击：Mac 是 `启动设计台.command`，Windows 是 `启动设计台.bat`。浏览器会自动打开 `http://127.0.0.1:4180`。
所有数据都在本机的 `文档/设计台数据` 文件夹里，不上传；换版本时直接用新包，数据会自动迁移并留一份备份。
需要真正的 AI 发散和看图评审时，在“设置”里填通义千问的 API Key（只保存在本机）。

## 开发

```bash
npm install
npm run dev                         # 本机开发，http://127.0.0.1:4180
npm run check                       # 类型检查 + 构建
bash packaging/build-package.sh     # 打 Mac + Windows 通用包到 dist-package/
node demo/build.mjs <输出目录>       # 打纯静态展示版（数据只在浏览器内存里）
```

发布新版本：把 `package.json` 里的 `version` 改大（例如 0.4.0 → 0.5.0）推到 main，GitHub Actions 会自动打包并发布成 Releases 里的 v0.5.0。

## 结构

- `src/app`：页面与 server actions（`actions.ts`）
- `src/components`：界面组件，`steps/` 是六个步骤
- `src/lib`：数据存储（`store.ts`，JSON 文件 + 备份）、需求识别、脑图、资产检索、评审、模型接口
- `packaging/`：启动脚本与打包脚本
- `demo/`：展示版，用同一套页面，把文件读写和模型换成浏览器内存实现
