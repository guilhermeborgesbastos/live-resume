<h1 align="center">
  <br>
  The Ultimate Personal Web Resume
  <br>
</h1>

<div align="center">

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/6f04e1e3103a4af58e5398e23106bb93)](https://www.codacy.com/manual/guilhermeborgesbastos/live-resume?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=guilhermeborgesbastos/live-resume&amp;utm_campaign=Badge_Grade) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fguilhermeborgesbastos%2Flive-resume.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fguilhermeborgesbastos%2Flive-resume?ref=badge_shield) [![Gitter](https://badges.gitter.im/live-resume/community.svg)](https://gitter.im/live-resume/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

</div>

<h4 align="center">
  :necktie: :briefcase: Build fast :rocket: and easy the best Personal Web Application resume!
  <br>:anchor: Stand out of the crowd by showing a professional website/resume.
</h4>

<div align="center">
<br>

[![Watch the video](/markdown/LiveResumePreview.gif)](https://guilhermeborgesbastos.com/?source=github)

</div>

You as a **Web Developer** should say no for the conventional text curriculum! **Why not make your own 'Live Resume' instead of an ordinary CV?!** All the code is fully available on this respository.

## What's included?

* A fully functional _Angular 9_ application with a customizable template and content;
* Totally responsive for the mobile and desktop devices;
* Internationalization for English and Portuguese _(easy for adding/removing new languages - in18 lib)_;
* Integrated with Google Analytics;
* Optimized for SEO  _( Crawler and Bots from Google, Bing, etc... )_;
* Using the schemas for structured data (schema.org);
* Firebase integration in the contact form;
* Composed of 5 custom sections ([Welcome](https://guilhermeborgesbastos.com/), [About Me](https://guilhermeborgesbastos.com/about), [Experiences](https://guilhermeborgesbastos.com/experience), [Posts](https://guilhermeborgesbastos.com/posts), and [Contact](https://guilhermeborgesbastos.com/contact));
* Router fragment friendly (e.g: https://guilhermeborgesbastos.com/posts );
* Source code verified by static code analyzers (safe and ready for production);
* Ready for CND usage.

## Prerequisite

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

## How to install and Execute locally

1. Fork this repository, by clicking the `Fork` button at the top-right on this page.
[![Learn how to fork GitHub projects](/markdown/fork.png)](https://guides.github.com/activities/forking/)

2. Clone the forked repository from your GitHub account.
```
https://github.com/[replace-with-your-github-username]/live-resume.git
```

3. Go to the cloned directory (e.g. `cd live-resume`).

4. Run `npm install`.

5. Inner the folder of the cloned project, start the application:
```
ng serve --host 0.0.0.0 --configuration=en
```
**Note:** the optional parameters:
* ` --host 0.0.0.0` useful if you want to see how your application runs on a mobile or from some other laptop/computer/network. 
* ` --configuration=en` in this example the application will be displayed in **en-US**, by replacing the `en`with `pt` => `--configuration=pt`, the application language would be **pt-BR**. 

6. After that, the command will start a server instance and listen on port `4200`. Open (http://localhost:4200/) in your browser. The **Live Resume** will be displayed.

> Please, feel free to make improvements, or any sort of changes and send it back via **pull request**. Your contribution is always welcome!

## Adobe XD Template

The Adobe XD template file can be downloaded [here](https://drive.google.com/file/d/1zNLb6hENYFOkfpRuSU-SyOZo5z-2-5WP/view?usp=sharing). With it, you can have full access to the layout resources.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).

## License

The theme is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).