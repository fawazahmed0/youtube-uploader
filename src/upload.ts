import { Credentials,Video } from "./types"
import puppeteer, { PuppeteerExtra } from 'puppeteer-extra'
import { Puppeteer, PuppeteerNode, PuppeteerNodeLaunchOptions,Browser,Page,errors,PuppeteerErrors } from "puppeteer"
import fs from 'fs-extra'

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const maxTitleLen = 100
const maxDescLen = 5000

const timeout = 60000
const height = 900
const width = 900

let browser:Browser, page:Page
let cookiesFilePath:string

const uploadURL = 'https://www.youtube.com/upload'
const homePageURL = 'https://www.youtube.com'
/**
 * import { upload } from 'youtube-videos-uploader' 
 * or
 * const { upload } = require('youtube-videos-uploader');
 */
export const upload= async (credentials:Credentials, videos:Video[], puppeteerLaunch?:PuppeteerNodeLaunchOptions)=> {
    cookiesFilePath = `./yt-auth/cookies-${credentials.email.split('@')[0]}.json`;
  
    await launchBrowser(puppeteerLaunch)

  const uploadedYTLink = []

  try {
    if (!fs.existsSync(cookiesFilePath)) await login(page, credentials)
  } catch (error:any) {
    if (error.message === 'Recapcha found') {
      if (browser) {
        await browser.close()
      }
      throw error
    }

    // Login failed trying again to login
    try {
      await login(page, credentials)
    } catch (error) {
      if (browser) {
        await browser.close()
      }
      throw error
    }
  }
  
  await changeHomePageLangIfNeeded(page)

  for (const video of videos) {
    const link = await uploadVideo(video)

    const { onSuccess } = video
    if (typeof onSuccess === 'function') {
      onSuccess(link)
    }
    
    uploadedYTLink.push(link)
  }

  await browser.close()

  return uploadedYTLink
}

async function changeLoginPageLangIfNeeded(localPage:Page) {

  const selectedLangSelector = '[aria-selected="true"]'
  try {
    await localPage.waitForSelector(selectedLangSelector)
  } catch(e:any) {
    throw new Error('Failed to find selected language : ' + e.name)
  }
  
 
  const selectedLang = await localPage.evaluate(
    (selectedLangSelector:any) => document.querySelector(selectedLangSelector).innerText,
    selectedLangSelector
  )

  if (! selectedLang) {
    throw new Error('Failed to find selected language : Empty text')
  }

  if (selectedLang.includes('English')) {
    return
  }

  await localPage.click(selectedLangSelector)

  await localPage.waitForTimeout(1000)

  const englishLangItemSelector = '[role="presentation"]:not([aria-hidden="true"])>[data-value="en-GB"]'

  try {
    await localPage.waitForSelector(englishLangItemSelector)
  } catch(e:any) {
    throw new Error('Failed to find english language item : ' + e.name)
  }
  
  await localPage.click(englishLangItemSelector)

  await localPage.waitForTimeout(1000)
}


async function changeHomePageLangIfNeeded(localPage:Page) {
  await localPage.goto(homePageURL)

  const avatarButtonSelector = 'button#avatar-btn'

  try {
    await localPage.waitForSelector(avatarButtonSelector)
  } catch(e:any) {
    throw new Error('Avatar/Profile picture button not found : ' + e.name)
  }
  
  await localPage.click(avatarButtonSelector)

  const langMenuItemSelector = 'yt-multi-page-menu-section-renderer+yt-multi-page-menu-section-renderer>#items>ytd-compact-link-renderer>a'
  try {
    await localPage.waitForSelector(langMenuItemSelector)
  } catch(e:any) {
    throw new Error('Language menu item selector/button(">") not found : ' + e.name)
  }

  const selectedLang = await localPage.evaluate(
    langMenuItemSelector => document.querySelector(langMenuItemSelector).innerText,
    langMenuItemSelector
  )

  if (! selectedLang) {
    throw new Error('Failed to find selected language : Empty text')
  }

  if (selectedLang.includes('English')) {
    await localPage.goto(uploadURL)

    return
  }

  await localPage.click(langMenuItemSelector)

  const englishItemXPath = '//*[normalize-space(text())=\'English (UK)\']'
  
  try {
    await localPage.waitForXPath(englishItemXPath)
  } catch (e:any) {
    throw new Error('English(UK) item selector not found : ' + e.name)
  }

  await localPage.waitForTimeout(3000)

await localPage.evaluate(
    (englishItemXPath:any) => {
        let element:  HTMLElement =   (document?.evaluate(englishItemXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue)as HTMLElement;
        element.click()
    },
    englishItemXPath
  )

  await localPage.goto(uploadURL)
}


async function launchBrowser (puppeteerLaunch?:PuppeteerNodeLaunchOptions) {
    const previousSession = fs.existsSync(cookiesFilePath)
    
    browser = await puppeteer.launch(puppeteerLaunch)
    page = await browser.newPage()
    await page.setDefaultTimeout(timeout)
    if (previousSession) {
      // If file exist load the cookies
      const cookiesString = fs.readFileSync(cookiesFilePath, { encoding: 'utf-8' });
      const parsedCookies = JSON.parse(cookiesString);
      if (parsedCookies.length !== 0) {
        for (let cookie of parsedCookies) {
          await page.setCookie(cookie)
        }
        console.log('Session has been loaded in the browser')
      }
    }
  await page.setViewport({ width: width, height: height })
  await page.setBypassCSP(true)
}

async function login (localPage:Page, credentials:Credentials) {
  await localPage.goto(uploadURL)

  await changeLoginPageLangIfNeeded(localPage)

  const emailInputSelector = 'input[type="email"]'
  await localPage.waitForSelector(emailInputSelector)

  await localPage.type(emailInputSelector, credentials.email, {delay: 50})
  await localPage.keyboard.press('Enter')


  const passwordInputSelector = 'input[type="password"]:not([aria-hidden="true"])'
  await localPage.waitForSelector(passwordInputSelector)
  await localPage.waitForTimeout(3000)
  await localPage.type(passwordInputSelector, credentials.pass, {delay: 50})

  await localPage.keyboard.press('Enter')

  try {
    await localPage.waitForNavigation()
  } catch (error:any) {
    const recaptchaInputSelector = 'input[aria-label="Type the text you hear or see"]'

    const isOnRecaptchaPage = await localPage.evaluate(
      recaptchaInputSelector => document.querySelector(recaptchaInputSelector) !== null,
      recaptchaInputSelector
    )

    if (isOnRecaptchaPage) {
      throw new Error('Recaptcha found')
    }

    throw new Error(error)
  }

  try {
    const uploadPopupSelector = 'ytcp-uploads-dialog'
    await localPage.waitForSelector(uploadPopupSelector, { timeout: 70000 })
  } catch (error) {
    if (credentials.recoveryemail) await securityBypass(localPage, credentials.recoveryemail)
  }

  const cookiesObject = await localPage.cookies()
  await fs.mkdirSync('./yt-auth', { recursive: true })
  // Write cookies to temp file to be used in other profile pages
  await fs.writeFile(cookiesFilePath, JSON.stringify(cookiesObject),
   function(err) { 
    if (err) {
    console.log('The file could not be written.', err)
    }
    console.log('Session has been successfully saved')
  })
  
}

// Login bypass with recovery email
async function securityBypass (localPage:Page, recoveryemail:string) {
  try {
    const confirmRecoveryXPath = '//*[normalize-space(text())=\'Confirm your recovery email\']'
    await localPage.waitForXPath(confirmRecoveryXPath)

    const confirmRecoveryBtn = await localPage.$x(confirmRecoveryXPath)
    await localPage.evaluate((el:any) => el.click(), confirmRecoveryBtn[0])
  } catch (error) {
    console.error(error)
  }

  await localPage.waitForNavigation({
    waitUntil: 'networkidle0'
  })
    const enterRecoveryXPath = '//*[normalize-space(text())=\'Enter recovery email address\']'
    await localPage.waitForXPath(enterRecoveryXPath)
    await localPage.waitForTimeout(5000)
    await localPage.focus('input[type="email"]')
    await localPage.waitForTimeout(3000)
    await localPage.type('input[type="email"]', recoveryemail, {delay: 100})
    await localPage.keyboard.press('Enter')
    await localPage.waitForNavigation({
      waitUntil: 'networkidle0'
    })
    const uploadPopupSelector = 'ytcp-uploads-dialog'
    await localPage.waitForSelector(uploadPopupSelector, { timeout: 60000 })
}

// `videoJSON = {}`, avoid `videoJSON = undefined` throw error.
async function uploadVideo (videoJSON:Video) {
  const pathToFile = videoJSON.path
  if (!pathToFile) {
    throw new Error("function `upload`'s second param `videos`'s item `video` must include `path` property.")
  }

  const title = videoJSON.title
  const description = videoJSON.description
  const tags = videoJSON.tags
  // For backward compatablility playlist.name is checked first
  const playlistName = videoJSON.playlist 
  const videoLang = videoJSON.language
  const thumb = videoJSON.thumbnail
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
      console.log('Failed to find the select files button for chapter ', nextText)
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
  if(thumb){
    const [thumbChooser] = await Promise.all([  
        page.waitForFileChooser(),
  await page.waitForSelector(`[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`),
  await page.click(`[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`)
])
  await thumbChooser.accept([thumb])
        }
  
  await page.waitForFunction('document.querySelectorAll(\'[id="textbox"]\').length > 1')
  const textBoxes = await page.$x('//*[@id="textbox"]')
  await page.bringToFront()
  // Add the title value
  await textBoxes[0].focus()
  await page.waitForTimeout(1000)
  await textBoxes[0].type(title.substring(0, maxTitleLen))
  // Add the Description content
  await textBoxes[1].type(description.substring(0, maxDescLen))

  const childOption = await page.$x('//*[contains(text(),"No, it\'s")]')
  await childOption[0].click()

  const moreOption = await page.$x('//*[normalize-space(text())=\'Show more\']')
  await moreOption[0].click()
  const playlist = await page.$x('//*[normalize-space(text())=\'Select\']')
  let createplaylistdone
  if (playlistName) {
    // Selecting playlist
    for(let i=0;i<2;i++){
    try{
    await page.evaluate(el => el.click(), playlist[0])
    // Type the playlist name to filter out
    await page.waitForSelector('#search-input')
    await page.focus(`#search-input`)
    await page.type(`#search-input`, playlistName)

    const playlistToSelectXPath = '//*[normalize-space(text())=\'' + playlistName + '\']'
    await page.waitForXPath(playlistToSelectXPath,{timeout:10000})
    const playlistNameSelector = await page.$x(playlistToSelectXPath)
    await page.evaluate(el => el.click(), playlistNameSelector[0])
    createplaylistdone = await page.$x('//*[normalize-space(text())=\'Done\']')
    await page.evaluate(el => el.click(), createplaylistdone[0])
    break;
    }catch(error){
     // Creating new playlist
    // click on playlist dropdown
    await page.evaluate(el => el.click(), playlist[0])
    // click New playlist button
    const newPlaylistXPath = '//*[normalize-space(text())=\'New playlist\'] | //*[normalize-space(text())=\'Create playlist\']'
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
    }
    }
  }
  // Add tags
  if (tags) {
    await page.focus(`[aria-label="Tags"]`)
    await page.type(`[aria-label="Tags"]`, tags.join(', ').substring(0, 495) + ', ')
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
  const publishXPath = '//*[normalize-space(text())=\'Publish\']/parent::*[not(@disabled)] | //*[normalize-space(text())=\'Save\']/parent::*[not(@disabled)]'
  await page.waitForXPath(publishXPath)
  // save youtube upload link
  await page.waitForSelector('[href^="https://youtu.be"]')
  const uploadedLinkHandle = await page.$('[href^="https://youtu.be"]')

  let uploadedLink
  do {
    await page.waitForTimeout(500)
    uploadedLink = await page.evaluate(e => e.getAttribute('href'), uploadedLinkHandle)
  } while (uploadedLink === 'https://youtu.be/')

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
  try {
    await page.waitForXPath(closeBtnXPath)
  } catch (e) {
    await browser.close()
    throw new Error('Please make sure you set up your default video visibility correctly, you might have forgotten. More infos : https://github.com/fawazahmed0/youtube-uploader#youtube-setup');
  }

  return uploadedLink
}
