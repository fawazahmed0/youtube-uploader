# youtube-uploader
Free youtube video uploader with no limits

**Note:** Daily upload limit is 100 videos per day

### Usage:
```js
// recoveryemail is optional, only required to bypass login with recoveryemail when prompted
const credentials = { email: 'email', pass: 'pass', recoveryemail: 'recoveryemail' }

//set create to true, if playlist doesn't exist
const playlist = { create: true, name: 'my playlist' }

const video1 = { path: '100.mp4', title: 'title 4', language: 'arabic', tags: ['helo', 'moto'], description: 'description 1', playlist: playlist }

const video2 = { path: '100.mp4', title: 'title 5', description: 'description' }

upload (credentials, [video1, video2]).then(console.log)
```
