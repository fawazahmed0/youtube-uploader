# youtube-uploader
Free youtube video uploader with no limits(100 videos/day)

### Installation:
`npm i youtube-videos-uploader`

### Usage:
```js
const { upload } = require('youtube-videos-uploader');

// recoveryemail is optional, only required to bypass login with recoveryemail when prompted
const credentials = { email: 'email', pass: 'pass', recoveryemail: 'recoveryemail' }

//set create to true, if playlist doesn't exist
const playlist = { create: true, name: 'my playlist' }

const video1 = { path: 'video1.mp4', title: 'title 1', language: 'english', tags: ['video', 'github'], description: 'description 1', playlist: playlist }

const video2 = { path: 'video2.mp4', title: 'title 2', description: 'description 2' }

upload (credentials, [video1, video2]).then(console.log)
```


### Donate:
https://fawazahmed0.github.io/donate.html
