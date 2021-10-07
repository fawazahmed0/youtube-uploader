<h1 align="center">Youtube Videos Uploader</h1>

<p align="center">
  <img width="460" height="300" src="https://github.com/fawazahmed0/youtube-uploader/raw/main/youtube.png">

[![npm version](https://img.shields.io/npm/v/youtube-videos-uploader.svg?style=flat)](https://www.npmjs.com/package/youtube-videos-uploader)

**In the name of God, who have guided me to do this work**

**Note1:** In case you find any issue, please raise an [issue](https://github.com/fawazahmed0/youtube-uploader/issues/new/choose), So that I can fix it.<br>
  
Please star this repo by clicking on [:star: button](#) above [:arrow_upper_right:](#)

### Features:
- No upload Limits (100 videos/day limit set by youtube for every channel)
- Free & Easy to use

### Prerequisite:
- Install [Nodejs](https://nodejs.org/en/)
  
### Installation:
```js
npm i youtube-videos-uploader
```

### Youtube Setup:
1. Go to your [Google Security settings](https://myaccount.google.com/security) and note down your recovery email and delete recovery phone from your google settings
2. Go to your [Youtube settings](https://studio.youtube.com/) and Setup your upload defaults Settings:


![Upload Defaults Settings](https://github.com/fawazahmed0/youtube-uploader/raw/main/defaultsettings.png)
  



### Usage:
```js
const { upload } = require('youtube-videos-uploader');

// recoveryemail is optional, only required to bypass login with recovery email if prompted for confirmation
const credentials = { email: 'email', pass: 'pass', recoveryemail: 'recoveryemail' }

// minimum required options to upload video
const video1 = { path: 'video1.mp4', title: 'title 1', description: 'description 1' }

const onVideoUploadSuccess = (videoUrl) => {
    // ..do something..
}
// Extra options like tags, thumbnail, language, playlist etc
const video2 = { path: 'video2.mp4', title: 'title 2', description: 'description 2', thumbnail:'thumbnail.png', language: 'english', tags: ['video', 'github'], playlist: 'playlist name', onSuccess:onVideoUploadSuccess }


// Returns uploaded video links in array
upload (credentials, [video1, video2]).then(console.log)

// OR
// This package uses Puppeteer, you can also pass Puppeteer launch configuration
upload (credentials, [video1, video2], {headless:false}).then(console.log)

// Refer Puppeteer documentation for more launch configurations like proxy etc
// https://pptr.dev/#?product=Puppeteer&version=main&show=api-puppeteerlaunchoptions
```

### Output:
```js
[ 'https://youtu.be/fh2Kreex5Eg', 'https://youtu.be/fh2Krefx5Eg' ]
```

### Contributors 🎉:
- [Pierre Miniggio( @pierreminiggio )](https://ggio.link/twitter) - For Adding [Youtube UI English Language Support](https://github.com/fawazahmed0/youtube-uploader/pull/16), [JSDoc](https://github.com/fawazahmed0/youtube-uploader/pull/18), and [debug message](https://github.com/fawazahmed0/youtube-uploader/pull/34)
- [TentacleSama4254 ](https://github.com/TentacleSama4254) - For Adding [Thumbnail option](https://github.com/fawazahmed0/youtube-uploader/pull/22) and fixing [tags error](https://github.com/fawazahmed0/youtube-uploader/pull/23)
- [Sai Charan](https://github.com/charan0017) - For [onSuccess Option](https://github.com/fawazahmed0/youtube-uploader/pull/32)
- [Tue Nguyen](https://github.com/TueNguyen2911) - For [Better error messages](https://github.com/fawazahmed0/youtube-uploader/pull/46)
  
### Support:
You can help support this package by as little as $3, because this package needs regular maintenance<br>
[Support Link](https://fawazahmed0.github.io/donate)

