
/*
Usage:
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

*/

const puppeteer = require('puppeteer-extra')

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const maxTitleLen = 100
const maxDescLen = 5000

const timeout = 60000
const height = 900
const width = 900

let browser, page

const uploadURL = 'https://www.youtube.com/upload'
const homePageURL = 'https://www.youtube.com'

// capitalizes all the first letters in a sentense
const capitalize = words => words.split(' ').map(w => w[0].toUpperCase() + w.substring(1)).join(' ')

module.exports.upload = upload

async function upload (credentials, videos) {
  await launchBrowser()

  const uploadedYTLink = []

  // sometimes chapter may begin from large no like 95,
  // that's why we are calling the func two times, to reach maxUploadNo
  try {
    await login(page, credentials)
  } catch (error) {
    console.error(error)
    console.log("Login failed trying again to login")
    await login(page, credentials)
  }
  
  await changeHomePageLangIfNeeded(page)

  for (const video of videos) {
    const link = await uploadVideo(video)
    uploadedYTLink.push(link)
  }

  await browser.close()

  return uploadedYTLink
}

/**
 * @param {import('puppeteer').Page} localPage
 * 
 * @returns {void} 
 */
async function changeLoginPageLangIfNeeded(localPage) {
  console.log('Checking selected lang...')

  const selectedLangSelector = '[aria-selected="true"]'
  try {
    await localPage.waitForSelector(selectedLangSelector)
  } catch(e) {
    throw new Error('Failed to find selected lang : ' + e.name)
  }
  
  
  /** @type {?string} */
  const selectedLang = await localPage.evaluate(
    selectedLangSelector => document.querySelector(selectedLangSelector).innerText,
    selectedLangSelector
  )

  if (! selectedLang) {
    throw new Error('Failed to find selected lang : Empty text')
  }

  if (selectedLang.includes('English')) {
    console.log('Selected lang is already english')

    return
  }

  console.log('Currently selected lang is ' + selectedLang + ', let\'s change it for English, shall we !')

  await localPage.click(selectedLangSelector)

  await localPage.waitForTimeout(1000)

  const englishLangItemSelector = '[role="presentation"]:not([aria-hidden="true"])>[data-value="en-GB"]'

  try {
    await localPage.waitForSelector(englishLangItemSelector)
  } catch(e) {
    throw new Error('Failed to find english lang item : ' + e.name)
  }
  
  await localPage.click(englishLangItemSelector)

  console.log('Changed to English !')

  await localPage.waitForTimeout(1000)
}

/**
 * @param {import('puppeteer').Page} localPage
 * 
 * @returns {void} 
 */
async function changeHomePageLangIfNeeded(localPage) {
  await localPage.goto(homePageURL)
  console.log('Checking selected lang...')

  const avatarButtonSelector = 'button#avatar-btn'

  try {
    await localPage.waitForSelector(avatarButtonSelector)
  } catch (e) {
    throw new Error('Avatar button not found : ' + e.name)
  }
  
  await localPage.click(avatarButtonSelector)

  const langMenuItemSelector = 'yt-multi-page-menu-section-renderer+yt-multi-page-menu-section-renderer>#items>ytd-compact-link-renderer>a'
  try {
    await localPage.waitForSelector(langMenuItemSelector)
  } catch (e) {
    throw new Error('Lang menu item selector not found : ' + e.name)
  }

  /** @type {?string} */
  const selectedLang = await localPage.evaluate(
    langMenuItemSelector => document.querySelector(langMenuItemSelector).innerText,
    langMenuItemSelector
  )

  if (! selectedLang) {
    throw new Error('Failed to find selected lang : Empty text')
  }

  if (selectedLang.includes('English')) {
    await localPage.goto(uploadURL)

    return
  }

  await localPage.click(langMenuItemSelector)

  const englishItemXPath = '//*[normalize-space(text())=\'English (UK)\']'
  
  try {
    await localPage.waitForXPath(englishItemXPath)
  } catch (e) {
    throw new Error('English item selector not found : ' + e.name)
  }

  await localPage.waitForTimeout(3000)

  await localPage.evaluate(
    englishItemXPath => document.evaluate(englishItemXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.click(),
    englishItemXPath
  )

  console.log('Changed to English !')

  await localPage.goto(uploadURL)
}

// context and browser is a global variable and it can be accessed from anywhere
// function that launches a browser
async function launchBrowser () {
  browser = await puppeteer.launch({ headless: true })
  page = await browser.newPage()
  await page.setDefaultTimeout(timeout)
  await page.setViewport({ width: width, height: height })
}

async function login (localPage, credentials) {
  await localPage.goto(uploadURL)

  await changeLoginPageLangIfNeeded(localPage)

  const emailInputSelector = 'input[type="email"]'
  await localPage.waitForSelector(emailInputSelector)

  await localPage.type(emailInputSelector, credentials.email)
  await localPage.keyboard.press('Enter')
  await localPage.waitForNavigation({
    waitUntil: 'networkidle0'
  })

  const passwordInputSelector = 'input[type="password"]:not([aria-hidden="true"])'
  await localPage.waitForSelector(passwordInputSelector)
  await localPage.type(passwordInputSelector, credentials.pass)

  await localPage.keyboard.press('Enter')

  await localPage.waitForNavigation()

  try {
    const uploadPopupSelector = 'ytcp-uploads-dialog'
    await localPage.waitForSelector(uploadPopupSelector, { timeout: 60000 })
  } catch (error) {
    console.error(error)
    await securityBypass(localPage, credentials.recoveryemail)
  }
}

// Login bypass with recovery email
async function securityBypass (localPage, recoveryemail) {
  try {
    const confirmRecoveryXPath = '//*[normalize-space(text())=\'Confirm your recovery email\']'
    await localPage.waitForXPath(confirmRecoveryXPath)

    const confirmRecoveryBtn = await localPage.$x(confirmRecoveryXPath)
    await localPage.evaluate(el => el.click(), confirmRecoveryBtn[0])
  } catch (error) {
    console.error(error)
  }

 
    const enterRecoveryXPath = '//*[normalize-space(text())=\'Enter recovery email address\']'
    await localPage.waitForXPath(enterRecoveryXPath)
    await localPage.focus('input[type="email"]')
    await localPage.type('input[type="email"]', recoveryemail)
    await localPage.keyboard.press('Enter')
    await localPage.waitForNavigation({
      waitUntil: 'networkidle0'
    })
    const selectBtnXPath = '//*[normalize-space(text())=\'Select files\']'
    await localPage.waitForXPath(selectBtnXPath)
}

async function uploadVideo (videoJSON) {
  const pathToFile = videoJSON.path

  const title = videoJSON.title
  const description = videoJSON.description
  const tags = videoJSON.tags
  const playlistName = videoJSON.playlist ? videoJSON.playlist.name : null
  const createplaylistbool = videoJSON.playlist ? videoJSON.playlist.create : null
  const videoLang = videoJSON.language

  await page.evaluate(() => { window.onbeforeunload = null })
  await page.goto(uploadURL)

  const closeBtnXPath = '//*[normalize-space(text())=\'Close\']'
  const selectBtnXPath = '//*[normalize-space(text())=\'Select files\']'
  for (let i = 0; i < 2; i++) {
    try {
      await page.waitForXPath(selectBtnXPath)
      await page.waitForXPath(closeBtnXPath)
      break
    } catch (error) {
      const nextText = i === 0 ? ' trying again' : ' failed again'
      console.log('failed to find the select files button for chapter ', chapter, nextText)
      console.error(error)
      await page.evaluate(() => { window.onbeforeunload = null })
      await page.goto(uploadURL)
    }
  }
  // Remove hidden closebtn text
  const closeBtn = await page.$x(closeBtnXPath)
  await page.evaluate(el => { el.textContent = 'oldclosse' }, closeBtn[0])

  const selectBtn = await page.$x(selectBtnXPath)
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    selectBtn[0].click()// button that triggers file selection
  ])
  await fileChooser.accept([pathToFile])
  // Wait for upload to complete
  await page.waitForXPath('//*[contains(text(),"Upload complete")]', { timeout: 0 })
  // Wait for upload to go away and processing to start
  await page.waitForXPath('//*[contains(text(),"Upload complete")]', { hidden: true, timeout: 0 })
  // Wait until title & description box pops up
  await page.waitForFunction('document.querySelectorAll(\'[id="textbox"]\').length > 1')
  const textBoxes = await page.$x('//*[@id="textbox"]')
  await page.bringToFront()
  // Add the title value
  await textBoxes[0].focus()
  await page.waitForTimeout(1000)
  await textBoxes[0].type(capitalize(title).substring(0, maxTitleLen))
  // Add the Description content
  await textBoxes[1].type(description.substring(0, maxDescLen))

  const childOption = await page.$x('//*[contains(text(),"No, it\'s")]')
  await childOption[0].click()

  const moreOption = await page.$x('//*[normalize-space(text())=\'Show more\']')
  await moreOption[0].click()
  const playlist = await page.$x('//*[normalize-space(text())=\'Select\']')
  let createplaylistdone
  if (createplaylistbool) {
    // Creating new playlist
    // click on playlist dropdown

    await page.evaluate(el => el.click(), playlist[0])
    // click New playlist button
    const newPlaylistXPath = '//*[normalize-space(text())=\'New playlist\']'
    await page.waitForXPath(newPlaylistXPath)
    const createplaylist = await page.$x(newPlaylistXPath)
    await page.evaluate(el => el.click(), createplaylist[0])
    // Enter new playlist name
    await page.keyboard.type(' ' + playlistName.substring(0, 148))
    // click create & then done button
    const createplaylistbtn = await page.$x('//*[normalize-space(text())=\'Create\']')
    await page.evaluate(el => el.click(), createplaylistbtn[1])
    createplaylistdone = await page.$x('//*[normalize-space(text())=\'Done\']')
    await page.evaluate(el => el.click(), createplaylistdone[0])
  } else if (playlistName) {
    // Selecting playlist
    await page.evaluate(el => el.click(), playlist[0])
    const playlistToSelectXPath = '//*[normalize-space(text())=\'' + playlistName + '\']'
    await page.waitForXPath(playlistToSelectXPath)
    const playlistNameSelector = await page.$x(playlistToSelectXPath)
    await page.evaluate(el => el.click(), playlistNameSelector[0])
    createplaylistdone = await page.$x('//*[normalize-space(text())=\'Done\']')
    await page.evaluate(el => el.click(), createplaylistdone[0])
  }
  // Add tags
  if (tags) {
    await page.focus('[placeholder="Add tag"]')
    await page.type('[placeholder="Add tag"]', tags.join(', ').substring(0, 495) + ', ')
  }

  // Selecting video language
  if (videoLang) {
    const langHandler = await page.$x('//*[normalize-space(text())=\'Video language\']')
    await page.evaluate(el => el.click(), langHandler[0])
    // translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
    const langName = await page.$x('//*[normalize-space(translate(text(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"))=\'' + videoLang.toLowerCase() + '\']')
    await page.evaluate(el => el.click(), langName[langName.length - 1])
  }
  // click next button
  const nextBtnXPath = '//*[normalize-space(text())=\'Next\']/parent::*[not(@disabled)]'
  await page.waitForXPath(nextBtnXPath)
  let next = await page.$x(nextBtnXPath)
  await next[0].click()
  // await sleep(2000)
  await page.waitForXPath(nextBtnXPath)
  // click next button
  next = await page.$x(nextBtnXPath)
  await next[0].click()

  await page.waitForXPath(nextBtnXPath)
  // click next button
  next = await page.$x(nextBtnXPath)
  await next[0].click()
//  const publicXPath = `//*[normalize-space(text())='Public']`
//  await page.waitForXPath(publicXPath)
//  const publicOption = await page.$x(publicXPath)
//  await publicOption[0].click()

  // Get publish button
  const publishXPath = '//*[normalize-space(text())=\'Publish\']/parent::*[not(@disabled)]'
  await page.waitForXPath(publishXPath)
  // save youtube upload link
  await page.waitForSelector('[href^="https://youtu.be"]')
  const uploadedLinkHandle = await page.$('[href^="https://youtu.be"]')
  const uploadedLink = await page.evaluate(e => e.getAttribute('href'), uploadedLinkHandle)
  let publish;
  for(let i=0;i<10;i++){
    try {
      publish = await page.$x(publishXPath)
      await publish[0].click()
      break
    } catch (error) {
      await page.waitForTimeout(5000)
    }
  
  }
  // await page.waitForXPath('//*[contains(text(),"Finished processing")]', { timeout: 0})
  // Wait for closebtn to show up
  await page.waitForXPath(closeBtnXPath)

  return uploadedLink
}
