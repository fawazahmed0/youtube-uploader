<h1 align="center">Youtube Videos Uploader</h1>

<p align="center">
  <img width="460" height="300" src="assets/youtube.png">

[![npm version](https://img.shields.io/npm/v/youtube-videos-uploader.svg?style=flat)](https://www.npmjs.com/package/youtube-videos-uploader)

------------

**In the name of God, who has guided me to do this work**

**Note1:** In case you find any issue, please raise an [issue](https://github.com/fawazahmed0/youtube-uploader/issues/new/choose), So that I can fix it.<br>
  
Please star this repo by clicking on [:star: button](#) above [:arrow_upper_right:](#)

### Features:
- No upload Limits (50+ videos/day limit set by youtube for every channel)
- Free & Easy to use

### Prerequisite:
- Install [Nodejs Current Version](https://nodejs.org/en/#:~:text=Current)
  
### Installation:
```js
npm i youtube-videos-uploader
```

### Youtube Setup:
1. Go to your [Google Security settings](https://myaccount.google.com/security) and note down your recovery email and delete recovery phone from your google settings
2. Go to your [Youtube settings](https://studio.youtube.com/) and Setup your upload defaults Settings:


![Upload Defaults Settings](assets/defaultsettings.png)
  



### Usage:
- #### Uploading a Video:  

```js

import { upload } from 'youtube-videos-uploader' //Typescript
//OR
const { upload } = require('youtube-videos-uploader'); //vanilla javascript

// recoveryemail is optional, only required to bypass login with recovery email if prompted for confirmation
const credentials = { email: 'Your Email', pass: 'Your Password', recoveryemail: 'Your Recovery Email' }

// minimum required options to upload video
const video1 = { path: 'video1.mp4', title: 'title 1', description: 'description 1' }

const onVideoUploadSuccess = (videoUrl) => {
    // ..do something..
}
// Extra options like tags, thumbnail, language, playlist etc
const video2 = { path: 'video2.mp4', title: 'title 2', description: 'description 2', thumbnail:'thumbnail.png', language: 'english', tags: ['video', 'github'], playlist: 'playlist name', channelName: 'Channel Name', onSuccess:onVideoUploadSuccess, skipProcessingWait: true, onProgress: (progress) => { console.log('progress', progress) }, uploadAsDraft: false, isAgeRestriction: false, isNotForKid: false, publishType: 'PUBLIC', isChannelMonetized: false }


// Returns uploaded video links in array
upload (credentials, [video1, video2]).then(console.log)

// OR
// This package uses Puppeteer, you can also pass Puppeteer launch configuration
upload (credentials, [video1, video2], {headless:false}).then(console.log)

// Refer Puppeteer documentation for more launch configurations like proxy etc
// https://pptr.dev/#?product=Puppeteer&version=main&show=api-puppeteerlaunchoptions
```

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Output:**
```js
[ 'https://youtu.be/fh2Kreex5Eg', 'https://youtu.be/fh2Krefx5Eg' ]
```
  
- #### Updating Metadata of a Youtube Video:    
  
 ```js

import { update } from 'youtube-videos-uploader' //Typescript
//OR
const { update } = require('youtube-videos-uploader'); //vanilla javascript
  
const credentials = { email: 'Your Email', pass: 'Your Password', recoveryemail: 'Your Recovery Email' }
   
const videoUpdate1 = { link: 'https://www.youtube.com/watch?v=w3jLJU7DT5E', title: 'Your New Title' }

const onVideoUpdateSuccess = (videoUrl) => {
    // ..do something..
}
// Extra options like tags, thumbnail, language, playlist etc
const videoUpdate2 = { link: 'https://www.youtube.com/watch?v=w3jLJU7DT5E', title: 'title 2', description: 'description 2', thumbnail: 'thumbnail.png', language: 'english', tags: ['video', 'github'], replaceTags: ['mytag'], playlist: 'playlist name', channelName: 'Channel Name', publishType: 'unlisted', publishToSubscriptionFeedAndNotifySubscribers: false , onSuccess: onVideoUpdateSuccess }

update(credentials, [videoUpdate1, videoUpdate2]).then(console.log)
// OR
update(credentials, [videoUpdate1, videoUpdate2], { headless: false }).then(console.log)
  
```
  
- #### Making a comment to youtube video:    
  
 ```js

import { comment } from 'youtube-videos-uploader' //Typescript
//OR
const { comment } = require('youtube-videos-uploader'); //vanilla javascript
  
const credentials = { email: 'Your Email', pass: 'Your Password', recoveryemail: 'Your Recovery Email' }
   
const comment1 = { link: 'https://www.youtube.com/watch?v=jEevRjRglFY', comment: 'Your comment', pin: false }

comment(credentials, [comment1]).then(console.log)  
//OR
comment(credentials, [comment1], {headless:false}).then(console.log)

```  
  
### Contributors 🎉:
- [Pierre Miniggio( @pierreminiggio )](https://ggio.link/twitter) - For Adding [Youtube UI English Language Support](https://github.com/fawazahmed0/youtube-uploader/pull/16), [JSDoc](https://github.com/fawazahmed0/youtube-uploader/pull/18), [debug message](https://github.com/fawazahmed0/youtube-uploader/pull/34), [Cleanup](https://github.com/fawazahmed0/youtube-uploader/pull/67), [shorts link refactor](https://github.com/fawazahmed0/youtube-uploader/pull/140), [log handling](https://github.com/fawazahmed0/youtube-uploader/pull/144) and [close browser on error](https://github.com/fawazahmed0/youtube-uploader/pull/155)
- [TentacleSama4254 ](https://github.com/TentacleSama4254) - For Adding [Thumbnail option](https://github.com/fawazahmed0/youtube-uploader/pull/22), fixing [tags error](https://github.com/fawazahmed0/youtube-uploader/pull/23), [TypeScript Rewrite, storing login session](https://github.com/fawazahmed0/youtube-uploader/pull/51), [video metadata update feature](https://github.com/fawazahmed0/youtube-uploader/pull/53) and [comments option](https://github.com/fawazahmed0/youtube-uploader/pull/58)
- [Sai Charan](https://github.com/charan0017) - For [onSuccess Option](https://github.com/fawazahmed0/youtube-uploader/pull/32)
- [Tue Nguyen](https://github.com/TueeNguyen) - For [Better error messages](https://github.com/fawazahmed0/youtube-uploader/pull/46)
- [weizhiqimail](https://github.com/weizhiqimail) - For [Extra Debug messages](https://github.com/fawazahmed0/youtube-uploader/pull/47)
- [DaddyFrosty](https://github.com/DaddyFrosty) - For [Path Escaping](https://github.com/fawazahmed0/youtube-uploader/pull/55), [Skip Processing wait](https://github.com/fawazahmed0/youtube-uploader/pull/57), [onProgress event](https://github.com/fawazahmed0/youtube-uploader/pull/60), [Show More being toggled incorrectly…](https://github.com/fawazahmed0/youtube-uploader/pull/180) and [Added support for selecting "Gaming" category aswell as game.](https://github.com/fawazahmed0/youtube-uploader/pull/182)
- [Owl Burger](https://github.com/Zebraslive) - For [Create Channel](https://github.com/fawazahmed0/youtube-uploader/pull/66)
- [Ítalo Andrade](https://github.com/italodeandra) - For [Channel Switcher](https://github.com/fawazahmed0/youtube-uploader/pull/73)
- [Dominic Findlay](https://github.com/DominicFindlay) - For Supporting [Single Quotes in playlist name](https://github.com/fawazahmed0/youtube-uploader/pull/82), [skip processing bug fix](https://github.com/fawazahmed0/youtube-uploader/pull/162) and [wait for upload complete](https://github.com/fawazahmed0/youtube-uploader/pull/225)
- [Dement6d](https://github.com/dement6d) - For [Better error messages](https://github.com/fawazahmed0/youtube-uploader/pull/99) & [handling 2FA](https://github.com/fawazahmed0/youtube-uploader/pull/101)
- [coooo77](https://github.com/coooo77) - For [uploading videos as draft option](https://github.com/fawazahmed0/youtube-uploader/pull/105)
- [L1teleau](https://github.com/L1teleau) - For [upload limit reached message](https://github.com/fawazahmed0/youtube-uploader/pull/115)
- [Sacredrel1c](https://github.com/sacredrel1c) - For [channel stuck due to no drop down menu](https://github.com/fawazahmed0/youtube-uploader/pull/118), [upload endless wait fix](https://github.com/fawazahmed0/youtube-uploader/pull/125), [click fix](https://github.com/fawazahmed0/youtube-uploader/pull/133), [Recursive lang change](https://github.com/fawazahmed0/youtube-uploader/pull/137), [publish short comment](https://github.com/fawazahmed0/youtube-uploader/pull/219) and [Fix youtube login](https://github.com/fawazahmed0/youtube-uploader/pull/228)
- [Chipped1](https://github.com/Chipped1) - For [Google login fix](https://github.com/fawazahmed0/youtube-uploader/pull/127)
- [Jared L](https://github.com/lhjt) - For [customSelectorUrl config option](https://github.com/fawazahmed0/youtube-uploader/pull/139)
- [Tiago Severino](https://github.com/TiagoSeverino) - For [Replacing readline](https://github.com/fawazahmed0/youtube-uploader/pull/157) and [Daily limit issue](https://github.com/fawazahmed0/youtube-uploader/pull/160)
- [PeterStegarus](https://github.com/PeterStegarus) - For [Daily upload error message](https://github.com/fawazahmed0/youtube-uploader/pull/163)
- [Kudou Sterain](https://github.com/hotrungnhan) - For [isAgeRestriction, isNotForKid option and other fixes](https://github.com/fawazahmed0/youtube-uploader/pull/175)
- [Andrew Glago](https://github.com/a11rew) - For [pinning option for comments](https://github.com/fawazahmed0/youtube-uploader/pull/186)
- [nhantamz](https://github.com/nhantamz) - For [setting english as default language](https://github.com/fawazahmed0/youtube-uploader/pull/191)
- [Damian](https://github.com/ClassAxion) - For [publish type support](https://github.com/fawazahmed0/youtube-uploader/pull/198), [Close browser before error](https://github.com/fawazahmed0/youtube-uploader/pull/201), [isChannelMonetized](https://github.com/fawazahmed0/youtube-uploader/pull/203) option, [PR build status check](https://github.com/fawazahmed0/youtube-uploader/pull/205), [improve monetization code](https://github.com/fawazahmed0/youtube-uploader/pull/206) and [userDataDir option](https://github.com/fawazahmed0/youtube-uploader/pull/213)
- [Soubhik Biswas](https://github.com/s0ubhik) - For [fixing home page selector](https://github.com/fawazahmed0/youtube-uploader/pull/229)
- [pm96](https://github.com/pm96) - For [publishToSubscriptionFeedAndNotifySubscribers](https://github.com/fawazahmed0/youtube-uploader/pull/232) option
- [bmarotta](https://github.com/bmarotta) - For [Enhanced logs and workarounds](https://github.com/fawazahmed0/youtube-uploader/pull/236)


<br>
<br>
