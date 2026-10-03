> [Change to English](https://github.com/guilhermeborgesbastos/live-resume/blob/master/README.md)

<h1 align="center">
  <br>
  终极个人网络简历 📃
  <br>
</h1>

<div align="center">
  
[![Open Source Love svg2](https://badges.frapsoft.com/os/v2/open-source.svg?v=103)](https://GitHub.com/guilhermeborgesbastos/live-resume/stargazers/) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fguilhermeborgesbastos%2Flive-resume.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fguilhermeborgesbastos%2Flive-resume?ref=badge_shield) [![Documentation Status](https://readthedocs.org/projects/ansicolortags/badge/?version=latest)](https://github.com/guilhermeborgesbastos/live-resume/wiki) [![GitHub tag](https://img.shields.io/github/tag/guilhermeborgesbastos/live-resume.svg)](https://github.com/guilhermeborgesbastos/live-resume/tags/)

 [![Gitter](https://badges.gitter.im/live-resume/community.svg)](https://gitter.im/live-resume/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) [![GitHub license](https://img.shields.io/github/license/Naereen/StrapDown.js.svg)](https://opensource.org/licenses/MIT) [![GitHub forks](https://img.shields.io/github/forks/guilhermeborgesbastos/live-resume.svg?style=social&label=Fork&maxAge=259100)](https://GitHub.com/guilhermeborgesbastos/live-resume/network/) [![GitHub stars](https://img.shields.io/github/stars/guilhermeborgesbastos/live-resume.svg?style=social&label=Star&maxAge=259100)](https://GitHub.com/guilhermeborgesbastos/live-resume/stargazers/)

</div>

<h4 align="center">
:anchor: 通过展示一个专业的网站/简历，让你脱颖而出。
  <br>:necktie: :briefcase: 快速、轻松地构建最佳的个人网络应用简历！
</h4>

<div align="center">
<br>

[![Watch the video](/markdown/LiveResumeGuilhermeBorgesBastos-v7.1.gif)](https://guilhermeborgesbastos.com/?source=github)

</div>

使用最好的**开源网络应用程序**（100%免费），轻松快速地构建专业个人网站和作品集，摆脱过时的文字简历。

## 包括哪些内容❓

* 一个带有可自定义模板和内容的完全功能性的 _Angular 21_（LTS） 应用程序
* 完全响应移动设备和桌面设备（也支持移动手势...）
* 英语和葡萄牙语的国际化支持（可以方便地添加/删除新语言） - in18库
* 移动导航分享（将简历分享到WhatsApp、LinkedIn、Facebook等原生应用）
* 完整的 [Wiki](https://github.com/guilhermeborgesbastos/live-resume/wiki) 支持
* 与Google Analytics集成
* 为SEO进行了优化（针对Google、Bing等爬虫和机器人）。
* 使用结构化数据模式（schema.org）
* 联系表单中集成了Firebase
* 由5个自定义部分组成 ([欢迎](https://guilhermeborgesbastos.com/), [关于我](https://guilhermeborgesbastos.com/about), [经历](https://guilhermeborgesbastos.com/experience), [帖子](https://guilhermeborgesbastos.com/posts), and [联系方式](https://guilhermeborgesbastos.com/contact))
* 友好的路由片段（例如：https://guilhermeborgesbastos.com/posts）
* 经过静态代码分析器验证的源代码（安全并做好了生产准备）

## 更新日志
[了解最新的改进](https://github.com/guilhermeborgesbastos/live-resume/CHANGELOG.md)

## 🗂 Wiki文档和 💬社区聊天
要获取有关设置、自定义或任何其他方面的更多帮助，请访问以下内容：

* [GitHub上的Wiki](https://github.com/guilhermeborgesbastos/live-resume/wiki) - 完整的文档，从入门到部署。
* [![Gitter](https://badges.gitter.im/live-resume/community.svg)](https://gitter.im/live-resume/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) - 一个社区聊天室，用于进一步讨论。

## ⚓ 前提条件

> 还有一个视频教程可供参考[观看](https://youtu.be/SmSCux_qx_Q) _[[视频已过时，如有需要仅供参考]_。

1. 需要 Node.js `^20.19.0`、`^22.12.0` 或 `^24.0.0`（Angular 21 支持的版本）。项目在 `.nvmrc` 中固定为 Node 24，使用 [nvm](https://github.com/nvm-sh/nvm) 时可直接运行 `nvm use`。要查看您的计算机上安装的Node.js版本，请在终端中键入以下命令：
```
node -v
```

2. 如果您的机器上没有安装Node.js，则可以前往 [此链接](https://nodejs.org/en/download/) 以安装 Node.js。

3. 需要 npm `10` 或更高版本（随上述 Node.js 版本一起安装）。可以通过以下命令查看：
```
npm -v
```

4. TypeScript（5.9）和 Angular CLI（21）作为项目依赖在本地安装，无需全局安装。

## 📥 本地安装和运行

> 另外一个视频教程也可参考，[点击观看](https://youtu.be/SmSCux_qx_Q)。

1. 请点击页面右上角的“Fork”按钮，Fork此代码库。
[![学习如何fork GitHub项目](/markdown/fork.png?cache=off)](https://guides.github.com/activities/forking/)

2. 克隆您在 GitHub 帐户中 fork 的存储库。
```
git clone https://github.com/[replace-with-your-github-username]/live-resume.git
```

3. 进入克隆的目录 (例如 `cd live-resume`)。

4. 运行 `npm ci`（或 `npm install`），无需 `--force` 或 `--legacy-peer-deps`。

5. 在克隆的项目文件夹内，启动应用：
```
npx ng serve -o --host 0.0.0.0 --configuration en
```

**P.S:** 也可以使用 `npm run start:en`（或 `npm run start:pt`）启动同样的开发服务器。如果希望使用全局的 `ng` 命令，请执行 `npm install -g @angular/cli@21`。

**注意：** 可选参数:
* `-o` 这是用于启动应用程序后自动打开默认浏览器的别名。
* ` --host 0.0.0.0` 如果您想在移动设备或其他计算机、笔记本电脑或网络上查看应用程序的运行情况，这个功能很有用。
* ` --configuration en` 在这个例子中，应用程序将以 **en-US** 显示，通过将 `en` 替换为 `pt` => `--configuration pt`，应用程序语言将变为 **pt-BR**。

6. 接下来，该命令将启动一个服务器实例，并侦听端口`4200`。在您的浏览器中打开(http://localhost:4200/)，即可打开**Live Resume**。

> 请随意进行改进或任何类型的更改，并通过**pull request**发送回来。欢迎您的贡献！

## ✅ 测试与质量检查

* `npm run lint`：ESLint 代码检查（`eslint.config.js`）。
* `npm test -- --watch=false --browsers=ChromeHeadless`：单元测试（Jasmine + Karma）。
* `npm run build-locale`：构建英语和葡萄牙语版本（缺少翻译时构建失败）。
* `npm run test:e2e`：构建两种语言版本并运行 Playwright 浏览器测试（首次运行前执行 `npx playwright install chromium`）。测试不会向 Firebase 或 Google Analytics 发送真实数据，截图和报告保存在 `test-results/` 中。

详细说明请参见英文版 README 的 “Testing and quality checks” 部分。

## 🔨 如何自定义？

在[Wiki文档](https://github.com/guilhermeborgesbastos/live-resume/wiki/applying-customizations)中，有一个特定的页面指导您如何对布局和其他内容应用自定义设置...[查看页面](https://github.com/guilhermeborgesbastos/live-resume/wiki/applying-customizations)

## 🖋 贡献

请随意添加新功能、语言支持、修复错误或改进文档。任何帮助都会受到赞赏！如果您进行任何改进，请将它们作为“拉取请求”发送回来。让我们保持它更好、更实用，并保持更新。

## 赞扬

这个项目使用了许多开源软件包：

- [Angular](https://github.com/angular)
- [Angular CLI](https://cli.angular.io)
- [Font Awesome](https://fontawesome.com)
- [Firebase](https://firebase.google.com)
- [HammerJS](https://hammerjs.github.io)
- [Playwright](https://playwright.dev)

---

> 网站： [www.guilhermeborgesbastos.com](https://www.guilhermeborgesbastos.com)<br>
> LinkedIn [profile](https://www.linkedin.com/in/guilhermeborgesbastos)<br>
> Facebook [profile](https://www.facebook.com/guilherme.borgesbastos)

## 📝 许可证

该主题以开放源代码的形式提供，遵循[MIT许可证](https://opensource.org/licenses/MIT)的条款。

[![Analytics](https://ga-beacon.appspot.com/UA-168686195-1/live-resume/home-page?pixel)](https://github.com/igrigorik/ga-beacon)
