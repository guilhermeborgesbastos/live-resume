<h1 align="center">
  <br>
  The Ultimate Personal Web Resume📃
  <br>
</h1>

<div align="center">
  
[![Open Source Love svg2](https://badges.frapsoft.com/os/v2/open-source.svg?v=103)](https://GitHub.com/guilhermeborgesbastos/live-resume/stargazers/) [![Codacy Badge](https://app.codacy.com/project/badge/Grade/6f04e1e3103a4af58e5398e23106bb93)](https://www.codacy.com/manual/guilhermeborgesbastos/live-resume?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=guilhermeborgesbastos/live-resume&amp;utm_campaign=Badge_Grade)[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fguilhermeborgesbastos%2Flive-resume.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fguilhermeborgesbastos%2Flive-resume?ref=badge_shield) [![Documentation Status](https://readthedocs.org/projects/ansicolortags/badge/?version=latest)](https://github.com/guilhermeborgesbastos/live-resume/wiki) [![GitHub tag](https://img.shields.io/github/tag/guilhermeborgesbastos/live-resume.svg)](https://github.com/guilhermeborgesbastos/live-resume/tags/)

 [![Gitter](https://badges.gitter.im/live-resume/community.svg)](https://gitter.im/live-resume/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) [![GitHub license](https://img.shields.io/github/license/Naereen/StrapDown.js.svg)](https://opensource.org/licenses/MIT) [![GitHub forks](https://img.shields.io/github/forks/guilhermeborgesbastos/live-resume.svg?style=social&label=Fork&maxAge=259100)](https://GitHub.com/guilhermeborgesbastos/live-resume/network/) [![GitHub stars](https://img.shields.io/github/stars/guilhermeborgesbastos/live-resume.svg?style=social&label=Star&maxAge=259100)](https://GitHub.com/guilhermeborgesbastos/live-resume/stargazers/)

</div>

<h4 align="center">
:anchor: Stand out of the crowd by showing a professional website/resume.
  <br>:necktie: :briefcase: Build fast :rocket: and easy the best Personal Web Application resume!
</h4>

<div align="center">
<br>

[![Watch the video](/markdown/LiveResumeGuilhermeBorgesBastos-v7.1.gif)](https://guilhermeborgesbastos.com/?source=github)

</div>

Get rid of your old and deprecated text resume by using the first **Open-source Web Application** _(100% free)_, which makes a professional personal website and portfolio easy and quick to build.

## What is included❓

* A fully functional _Angular 13_ application with a customizable template and content;
* Totally responsive for the mobile and desktop devices _(allow mobile gestures too... ;))_;
* Internationalization for English and Portuguese _(easy for adding/removing new languages - in18 lib)_;
* Mobile navigation sharing _(Share the resume with native apps like Whatsapp, LinkedIn, Facebook, etc...)_;
* A complete [Wiki](https://github.com/guilhermeborgesbastos/live-resume/wiki) that provides support;
* Integrated with Google Analytics;
* Optimized for SEO  _( Crawler and Bots from Google, Bing, etc... )_;
* Using the schemas for structured data (schema.org);
* Firebase integration in the contact form;
* Composed of 5 custom sections ([Welcome](https://guilhermeborgesbastos.com/), [About Me](https://guilhermeborgesbastos.com/about), [Experiences](https://guilhermeborgesbastos.com/experience), [Posts](https://guilhermeborgesbastos.com/posts), and [Contact](https://guilhermeborgesbastos.com/contact));
* Router fragment friendly (e.g: https://guilhermeborgesbastos.com/posts );
* Source code verified by static code analyzers _(safe and ready for production)_;

## Changelog
[Learn about the latest improvements.](https://github.com/guilhermeborgesbastos/live-resume/CHANGELOG.md)

## 🗂 Wiki Documentation & 💬 Community Chat

To get more help on the setup, customization or any other aspect, accessing the following:

* [Wiki on GitHub](https://github.com/guilhermeborgesbastos/live-resume/wiki) - A complete documentation, from _getting started_ until _deploy_.
* [![Gitter](https://badges.gitter.im/live-resume/community.svg)](https://gitter.im/live-resume/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) - A _Community Chat_ for further discussions.

## ⚓Prerequisite

> A video tutorial is also available [watch it](https://youtu.be/SmSCux_qx_Q).

1. It is required to have Node.js with version _12.18.0_ or higher. To see what version of Node.js is installed on your machine type the following command in the terminal:
```
node -v
```

2. If you haven't installed Node.js in your machine then go to [this link](https://nodejs.org/en/download/) in order to install node.

3. It is required to have NPM with version _6.14.0_ or higher. To see what version of NPM is installed on your machine type the following command in the terminal:
```
npm -v
```

4. If you haven't installed NPM in your machine then go to [this link](https://www.npmjs.com/get-npm) in order to install NPM.

## 📥 Installing and Executing locally

> A video tutorial is also available [watch it](https://youtu.be/SmSCux_qx_Q).

1. Fork this repository, by clicking the `Fork` button at the top-right on this page.
[![Learn how to fork GitHub projects](/markdown/fork.png?cache=off)](https://guides.github.com/activities/forking/)

2. Clone the forked repository from your GitHub account.
```
git clone https://github.com/[replace-with-your-github-username]/live-resume.git
```

3. Go to the cloned directory (e.g. `cd live-resume`).

4. Run `npm install`.

5. Inner the folder of the cloned project, start the application:
```
ng serve -o --host 0.0.0.0 --configuration=en
```
**Note:** the optional parameters:
* `-o` aliases for opening the default browser as soon the application is served.
* ` --host 0.0.0.0` is useful if you want to see how your application runs on a mobile or from some other laptop/computer/network. 
* ` --configuration=en` in this example the application will be displayed in **en-US**, by replacing the `en`with `pt` => `--configuration=pt`, the application language would be **pt-BR**. 

6. After that, the command will start a server instance and listen on port `4200`. Open (http://localhost:4200/) in your browser. The **Live Resume** will be displayed.

> Please, feel free to make improvements, or any sort of changes and send it back via **pull request**. Your contribution is always welcome!

## 🔨 How to customize?

In the [Wiki Doc.](https://github.com/guilhermeborgesbastos/live-resume/wiki/applying-customizations) there is a specific page supporting you on how to apply customizations to the layout and more... [See page](https://github.com/guilhermeborgesbastos/live-resume/wiki/applying-customizations)

## 🖋 Contribute

Feel free to add new features, language supports, fix bugs, or improve the docs. Any kind of help is appreciated! If you make any kind of improvements, please, send them back as a **Pull Request**. Let's keep making it better and up-to-date.

## Credits©️

This project uses several open source packages:

- [Angular](https://github.com/angular)
- [Angular CLI](https://cli.angular.io)
- [Navigator Share](https://www.npmjs.com/package/ng-navigator-share)
- [Font Awesome](https://fontawesome.com)

---

> Site [www.guilhermeborgesbastos.com](https://www.guilhermeborgesbastos.com)<br>
> LinkedIn [profile](https://www.linkedin.com/in/guilhermeborgesbastos)<br>
> Facebook [profile](https://www.facebook.com/guilherme.borgesbastos)

## 📝 License

The theme is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

[![Analytics](https://ga-beacon.appspot.com/UA-168686195-1/live-resume/home-page?pixel)](https://github.com/igrigorik/ga-beacon)
