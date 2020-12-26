# youtube-uploader
Free youtube video uploader with no limits

### Usage:
```js
const credentials = { email: 'email', pass: 'pass', recoveryemail: 'recoveryemail' }

const playlist = { create: true, name: 'arabic lang' }

const video1 = { path: '100.mp4', title: 'title 4', language: 'arabic', tags: ['helo', 'moto'], description: 'description 1', playlist: playlist }

const video2 = { path: '100.mp4', title: 'title 5', description: 'description' }

upload (credentials, [video1, video2]).then(console.log)
```