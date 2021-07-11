<h1 align="center">Youtube Videos Uploader</h1>

<p align="center">
  <img width="460" height="300" src="https://github.com/fawazahmed0/youtube-uploader/raw/main/youtube.png">

[![npm version](https://img.shields.io/npm/v/youtube-videos-uploader.svg?style=flat)](https://www.npmjs.com/package/youtube-videos-uploader)
[![](https://img.shields.io/badge/Donate-Donate-orange)](https://fawazahmed0.github.io/donate)  

**In the name of God, who have guided me to do this work**

**Note1:** In case you find any issue, please raise an [issue](https://github.com/fawazahmed0/youtube-uploader/issues/new/choose), So that I can fix it.<br>
  
Please star this repo by clicking on [:star: button](#) above [:arrow_upper_right:](#)

### Features
- No upload Limits (100 videos/day limit set by youtube for every channel)
- Free & Easy to use

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

//set create to true, if playlist doesn't exist
const playlist = { create: true, name: 'my playlist' }
// Extra options like tags, language, playlist etc
const video2 = { path: 'video2.mp4', title: 'title 2', description: 'description 2', thumbnail:'thumbnail.png', language: 'english', tags: ['video', 'github'], playlist: playlist }

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
- [Pierre Miniggio( @pierreminiggio )](https://ggio.link/twitter) - For Adding [Youtube UI English Language Support](https://github.com/fawazahmed0/youtube-uploader/pull/16) 
- [TentacleSama4254 ](https://github.com/TentacleSama4254) - For Adding [Thumbnail option](https://github.com/fawazahmed0/youtube-uploader/pull/22)
  
### Donate($3 or more):
Please do consider donating $3 or more, if this project is helpful to you:<br>
[Donate Link](https://fawazahmed0.github.io/donate.html)

