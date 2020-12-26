<h1 align="center">Youtube Videos Uploader</h1>

<p align="center">
  <img width="460" height="300" src="https://github.com/fawazahmed0/youtube-uploader/raw/main/youtube.png">
</p>




**In the name of God, who have guided me to do this work**


Free youtube video uploader with no limits(100 videos/day)

### Installation:
```js
npm i youtube-videos-uploader
```

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
const video2 = { path: 'video2.mp4', title: 'title 2', description: 'description 2', language: 'english', tags: ['video', 'github'], playlist: playlist }

// Returns uploaded video links in array
upload (credentials, [video1, video2]).then(console.log)
```

### Output:
```js
[ 'https://youtu.be/fh2Kreex5Eg', 'https://youtu.be/fh2Krefx5Eg' ]
```

### Donate:
https://fawazahmed0.github.io/donate.html

Please Star this repo by clicking on [:star: button](#) above [:arrow_upper_right:](#)

