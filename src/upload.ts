import {
    Credentials,
    Video,
    VideoToEdit,
    Comment,
    VideoProgress,
    ProgressEnum,
    MessageTransport,
    GameData
} from './types'
import puppeteer from 'puppeteer-extra'
import { PuppeteerNodeLaunchOptions, Browser, Page } from 'puppeteer'
import fs from 'fs-extra'
import path from 'path'

const StealthPlugin = require('puppeteer-extra-plugin-stealth')()
StealthPlugin.enabledEvasions.delete('iframe.contentWindow')
StealthPlugin.enabledEvasions.delete('navigator.plugins')
puppeteer.use(StealthPlugin)

const maxTitleLen = 100
const maxDescLen = 5000

const timeout = 60000
const height = 900
const width = 900

let browser: Browser, page: Page
let cookiesDirPath: string
let cookiesFilePath: string

const invalidCharacters = ['<', '>']

const uploadURL = 'https://www.youtube.com/upload?persist_gl=1&gl=US&persist_hl=1&hl=en'
const homePageURL = 'https://www.youtube.com/?persist_gl=1&gl=US&persist_hl=1&hl=en'

const defaultMessageTransport: MessageTransport = {
    log: console.log,
    userAction: console.log,
    debug: console.debug,
    error: console.error,
    warn: console.warn
}

let lastSelectedChannel = "";

/**
 * import { upload } from 'youtube-videos-uploader'
 * or
 * const { upload } = require('youtube-videos-uploader');
 */
export const upload = async (
    credentials: Credentials,
    videos: Video[],
    puppeteerLaunch?: PuppeteerNodeLaunchOptions,
    messageTransport: MessageTransport = defaultMessageTransport
) => {
    cookiesDirPath = path.join('.', 'yt-auth')
    cookiesFilePath = path.join(
        cookiesDirPath,
        `cookies-${credentials.email.split('@')[0].replace(/\./g, '_')}-${credentials.email
            .split('@')[1]
            .replace(/\./g, '_')}.json`
    )

    const useCookieStore = !puppeteerLaunch?.userDataDir

    if (!useCookieStore) {
        messageTransport.log(`UserDataDir detected in options. Disabling cookie store.`)
    }

    messageTransport.debug("Launching browser...");
    await launchBrowser(puppeteerLaunch, useCookieStore)
    messageTransport.debug("Browser successfully launched");

    try {
        await loadAccount(credentials, messageTransport, useCookieStore)
        messageTransport.debug("Account loaded");

        const uploadedYTLink: string[] = [];
        lastSelectedChannel = "";

        for (const video of videos) {
            try {
                messageTransport.log(`Uploading video ${video.title} [${video.path}]`);
                const link = await uploadVideo(video, messageTransport)
                messageTransport.log(`Video ${video.title} [${video.path}] successfully uploaded`);

                const { onSuccess } = video
                if (typeof onSuccess === 'function') {
                    try {
                        onSuccess(link, video)
                    }
                    catch (err) {
                        messageTransport.warn(`Error calling onSuccess function. Will proceed with other videos. Error: ${err}`);
                    }                    
                }

                uploadedYTLink.push(link)
            }
            catch (err) {
                messageTransport.error(`Error uploading video ${video.title} [${video.path}]: ${err}`);
                throw err;
            }
            
        }

        await browser.close()

        return uploadedYTLink
    } catch (err) {
        messageTransport.error(err);
        if (browser) await browser.close()

        throw err
    }
}

// `videoJSON = {}`, avoid `videoJSON = undefined` throw error.
async function uploadVideo(videoJSON: Video, messageTransport: MessageTransport) {
    const pathToFile = videoJSON.path
    if (!pathToFile) {
        throw new Error("function `upload`'s second param `videos`'s item `video` must include `path` property.")
    }
    for (let i in invalidCharacters)
        if (videoJSON.title.includes(invalidCharacters[i]))
            throw new Error(
                `"${videoJSON.title}" includes a character not allowed in youtube titles (${invalidCharacters[i]})`
            )

    if (videoJSON.channelName && videoJSON.channelName !== lastSelectedChannel) {
        await changeChannel(videoJSON.channelName);
        messageTransport.debug(`Channel set to ${videoJSON.channelName}`);
        lastSelectedChannel = videoJSON.channelName;
    }

    const title = videoJSON.title
    const description = videoJSON.description
    const tags = videoJSON.tags
    // For backward compatablility playlist.name is checked first
    const playlistName = videoJSON.playlist
    const videoLang = videoJSON.language
    const gameTitleSearch = videoJSON.gameTitleSearch
    const thumb = videoJSON.thumbnail
    const uploadAsDraft = videoJSON.uploadAsDraft
    await page.evaluate(() => {
        window.onbeforeunload = null
    })
    await page.goto(uploadURL)

    messageTransport.debug(`  >> ${videoJSON.title} - Upload URL opened`);

    const closeBtnXPath = "//*[normalize-space(text())='Close']"
    const selectBtnXPath = "//*[normalize-space(text())='Select files']"
    const saveCloseBtnXPath = '//*[@aria-label="Save and close"]/tp-yt-iron-icon'
    const createBtnXPath = '//*[@id="create-icon"]/tp-yt-iron-icon'
    const addVideoBtnXPath = '//*[@id="text-item-0"]/ytcp-ve/div/div/yt-formatted-string'
    if (await page.waitForXPath(createBtnXPath, { timeout: 5000 }).catch(() => null)) {
        const createBtn = await page.$x(createBtnXPath)
        await createBtn[0].click()
    }
    if (await page.waitForXPath(addVideoBtnXPath, { timeout: 5000 }).catch(() => null)) {
        const addVideoBtn = await page.$x(addVideoBtnXPath)
        await addVideoBtn[0].click()
    }
    for (let i = 0; i < 2; i++) {
        try {
            await page.waitForXPath(selectBtnXPath)
            await page.waitForXPath(closeBtnXPath)
            break
        } catch (error) {
            const nextText = i === 0 ? ' trying again' : ' failed again'
            messageTransport.log('Failed to find the select files button' + nextText)
            messageTransport.log(error)
            await page.evaluate(() => {
                window.onbeforeunload = null
            })
            await page.goto(uploadURL)
        }
    }
    // Remove hidden closebtn text
    const closeBtn = await page.$x(closeBtnXPath)
    await page.evaluate((el) => {
        el.textContent = 'oldclosse'
    }, closeBtn[0])

    const selectBtn = await page.$x(selectBtnXPath)
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        selectBtn[0].click() // button that triggers file selection
    ])
    await fileChooser.accept([pathToFile]);
    messageTransport.debug(`  >> ${videoJSON.title} - File chooser accepted`);

    // Setup onProgress
    let progressChecker: any
    let progress: VideoProgress = { progress: 0, stage: ProgressEnum.Uploading }
    if (videoJSON.onProgress) {
        videoJSON.onProgress(progress)
        progressChecker = setInterval(async () => {
            let curProgress = await page.evaluate(() => {
                let items = document.querySelectorAll('span.progress-label.ytcp-video-upload-progress')
                for (let i = 0; i < items.length; i++) {
                    if (items.item(i).textContent!.indexOf('%') === -1) continue
                    return items.item(i).textContent
                }
            })
            if (progressChecker == undefined || !curProgress) return
            curProgress = curProgress.split(' ').find((txt: string) => txt.indexOf('%') != -1)
            let newProgress = curProgress ? parseInt(curProgress.slice(0, -1)) : 0
            if (progress.progress == newProgress) return
            progress.progress = newProgress
            videoJSON.onProgress!(progress)
        }, 500)
    }

    const errorMessage = await page.evaluate(() =>
        (document.querySelector('.error-area.style-scope.ytcp-uploads-dialog') as HTMLElement)?.innerText.trim()
    )
    if (errorMessage) {
        await browser.close()
        throw new Error('Youtube returned an error : ' + errorMessage)
    }    

    // Wait for upload to complete, but not checks
    const uploadCompletePromise = page
        .waitForXPath('//ytcp-video-upload-progress/span[contains(@class,"progress-label") and contains(text(),"Upload complete")]', {
            timeout: 0
        })
        .then(() => 'uploadComplete');

    // Check if daily upload limit is reached
    const dailyUploadPromise = page
        .waitForXPath('//div[contains(text(),"Daily upload limit reached")]', { timeout: 0 })
        .then(() => 'dailyUploadReached')
    const uploadResult = await Promise.any([uploadCompletePromise, dailyUploadPromise])
    if (uploadResult === 'dailyUploadReached') {
        browser.close()
        throw new Error('Daily upload limit reached')
    }

    // Wait for upload to go away and processing to start, skip the wait if the user doesn't want it.
    if (!videoJSON.skipProcessingWait) {
        // waits for checks to be complete (upload should be complete already)
        await page.waitForXPath('//*[contains(text(),"Video upload complete")]', { hidden: true, timeout: 0 });
        messageTransport.debug(`  >> ${videoJSON.title} - Video upload finished`);    
    } else {
        await sleep(5000)
    }

    if (videoJSON.onProgress) {
        progress = { progress: 0, stage: ProgressEnum.Processing }
        videoJSON.onProgress(progress)
    }
    if (videoJSON.onProgress) {
        clearInterval(progressChecker)
        progressChecker = undefined
        progress = { progress: 100, stage: ProgressEnum.Done }
        videoJSON.onProgress(progress)
    }

    // Wait until title & description box pops up
    if (thumb) {
        let thumbnailChooserXpath = xpathTextSelector('upload thumbnail')
        await page.waitForXPath(thumbnailChooserXpath)
        const thumbBtn = await page.$x(thumbnailChooserXpath)
        const [thumbChooser] = await Promise.all([
            page.waitForFileChooser(),
            thumbBtn[0].click() // button that triggers file selection
        ])
        await thumbChooser.accept([thumb])
    }
    await page.waitForFunction('document.querySelectorAll(\'[id="textbox"]\').length > 1')
    const textBoxes = await page.$x('//*[@id="textbox"]')
    await page.bringToFront()
    // Add the title value
    await textBoxes[0].focus()
    await page.waitForTimeout(1000)
    await textBoxes[0].evaluate((e) => ((e as any).__shady_native_textContent = ''))
    await textBoxes[0].type(title.substring(0, maxTitleLen))
    // Add the Description content
    await textBoxes[0].evaluate((e) => ((e as any).__shady_native_textContent = ''))
    await textBoxes[1].type(description.substring(0, maxDescLen));

    messageTransport.debug(`  >> ${videoJSON.title} - Title and description set`);

    const childOption = await page.$x('//*[contains(text(),"No, it\'s")]')
    await childOption[0].click()

    // There is no reason for this to be called. Also you should be using #toggle-button not going by the text...
    // const moreOption = await page.$x("//*[normalize-space(text())='Show more']")
    // await moreOption[0]?.click()

    const playlist = await page.$x("//*[normalize-space(text())='Select']")
    let createplaylistdone
    if (playlistName) {
        let playlistSet = false;
        // Selecting playlist
        for (let i = 0; i < 2; i++) {
            try {
                await page.evaluate((el) => el.click(), playlist[0])
                // Type the playlist name to filter out
                await page.waitForSelector('#search-input')
                await page.focus(`#search-input`)
                await page.type(`#search-input`, playlistName)

                const escapedPlaylistName = escapeQuotesForXPath(playlistName)
                const playlistToSelectXPath = '//*[normalize-space(text())=' + escapedPlaylistName + ']'
                await page.waitForXPath(playlistToSelectXPath, { timeout: 10000 })
                const playlistNameSelector = await page.$x(playlistToSelectXPath)
                await page.evaluate((el) => el.click(), playlistNameSelector[0])
                createplaylistdone = await page.$x("//*[normalize-space(text())='Done']")
                await page.evaluate((el) => el.click(), createplaylistdone[0]);
                playlistSet = true;
                break
            } catch (error) {
                messageTransport.log(`  >> ${videoJSON.title} - ${playlistName} not found. Creating...`);
                // Creating new playlist
                // click on playlist dropdown
                await page.evaluate((el) => el.click(), playlist[0])
                // click New playlist button
                const newPlaylistXPath =
                    "//*[normalize-space(text())='New playlist'] | //*[normalize-space(text())='Create playlist']"
                await page.waitForXPath(newPlaylistXPath)
                const createplaylist = await page.$x(newPlaylistXPath)
                await page.evaluate((el) => el.click(), createplaylist[0])
                // Enter new playlist name
                await page.keyboard.type(' ' + playlistName.substring(0, 148))
                // click create & then done button
                const createplaylistbtn = await page.$x("//*[normalize-space(text())='Create']")
                await page.evaluate((el) => el.click(), createplaylistbtn[1])
                createplaylistdone = await page.$x("//*[normalize-space(text())='Done']")
                await page.evaluate((el) => el.click(), createplaylistdone[0]);
                playlistSet = true;
            }
        }
        if (playlistSet) {
            messageTransport.debug(`  >> ${videoJSON.title} - Playlist set to ${playlistName}`);
        } else {
            messageTransport.warn(`  >> ${videoJSON.title} - Failed setting playlist`);
        }
        
    }

    if (!videoJSON.isNotForKid) {
        await page.click("tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_MFK']").catch(() => {})
    } else if (videoJSON.isAgeRestriction) {
        await page.$eval(`tp-yt-paper-radio-button[name='VIDEO_AGE_RESTRICTION_SELF']`, (e: any) => e.click())
    } else {
        await page.click("tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_NOT_MFK']").catch(() => {})
    }
    messageTransport.debug(`  >> ${videoJSON.title} - Kid restriction set`);
    // await page.waitForXPath('//ytcp-badge[contains(@class,"draft-badge")]//div[contains(text(),"Saved as private")]', { timeout: 0})

    // await page.click("#toggle-button")
    // Was having issues because of await page.$x("//*[normalize-space(text())='Show more']").click(), so I started messing with the line above.
    // The issue was obviously not the line above but I either way created code to ensure that Show more has been pressed before proceeding.
    let showMoreButton = await page.$('#toggle-button')
    if (showMoreButton == undefined) throw `uploadVideo - Toggle button not found.`
    else {
        // console.log( "Show more start." )
        while ((await page.$('ytcp-video-metadata-editor-advanced')) == undefined) {
            // console.log( "Show more while." )
            await showMoreButton.click()
            await sleep(1000)
        }
        // console.log( "Show more finished." )
    }

    // Add tags
    if (tags) {
        //show more
        try {
            await page.focus(`[aria-label="Tags"]`)
            await page.type(`[aria-label="Tags"]`, tags.join(', ').substring(0, 495) + ', ')
        } catch (err) {}
        messageTransport.debug(`  >> ${videoJSON.title} - Tags set to ${tags.join(', ')}`);
    }

    // Set pusblish to subscription feed and notify subscribers to false
    if(videoJSON.publishToSubscriptionFeedAndNotifySubscribers === false) {
        await page.waitForSelector("#notify-subscribers > div:nth-child(1) > div:nth-child(1)")
        await page.click("#notify-subscribers > div:nth-child(1) > div:nth-child(1)");
    }
    // Selecting video language
    if (videoLang) {
        const langHandler = await page.$x("//*[normalize-space(text())='Video language']")
        await page.evaluate((el) => el.click(), langHandler[0])
        // translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
        const langName = await page.$x(
            '//*[normalize-space(translate(text(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"))=\'' +
                videoLang.toLowerCase() +
                "']"
        )
        await page.evaluate((el) => el.click(), langName[langName.length - 1]);
        messageTransport.debug(`  >> ${videoJSON.title} - Video language set to ${videoLang}`);
    }

    // Setting Game Title ( Will also set Category to gaming )
    if (gameTitleSearch) {
        const resultSelectGame = await selectGame(page, gameTitleSearch, messageTransport, videoJSON.gameSelector);
        if (resultSelectGame) {
            messageTransport.debug(`  >> ${videoJSON.title} - Game title set to ${gameTitleSearch}`);
        } else {
            messageTransport.warn(`  >> ${videoJSON.title} - Failed setting game title`);
        }
        
    }

    const nextBtnXPath = "//*[normalize-space(text())='Next']/parent::*[not(@disabled)]"
    let next

    await page.waitForXPath(nextBtnXPath)
    next = await page.$x(nextBtnXPath)
    await next[0].click()

    if (videoJSON.isChannelMonetized) {
        try {
            await page.waitForSelector('#child-input ytcp-video-monetization', { visible: true, timeout: 10000 })

            await page.waitForTimeout(1500)

            await page.click('#child-input ytcp-video-monetization')

            await page.waitForSelector(
                'ytcp-video-monetization-edit-dialog.cancel-button-hidden .ytcp-video-monetization-edit-dialog #radioContainer #onRadio'
            )
            await page.evaluate(() =>
                (
                    document.querySelector(
                        'ytcp-video-monetization-edit-dialog.cancel-button-hidden .ytcp-video-monetization-edit-dialog #radioContainer #onRadio'
                    ) as HTMLInputElement
                ).click()
            )

            await page.waitForTimeout(1500)

            await page.waitForSelector(
                'ytcp-video-monetization-edit-dialog.cancel-button-hidden .ytcp-video-monetization-edit-dialog #save-button',
                { visible: true }
            )
            await page.click(
                'ytcp-video-monetization-edit-dialog.cancel-button-hidden .ytcp-video-monetization-edit-dialog #save-button'
            )

            await page.waitForTimeout(1500)

            await page.waitForXPath(nextBtnXPath)
            next = await page.$x(nextBtnXPath)
            await next[0].click()
        } catch {}

        try {
            await page.waitForSelector(
                '.ytpp-self-certification-questionnaire .ytpp-self-certification-questionnaire #checkbox-container',
                { visible: true, timeout: 10000 }
            )
            await page.evaluate(() =>
                (
                    document.querySelector(
                        '.ytpp-self-certification-questionnaire .ytpp-self-certification-questionnaire #checkbox-container'
                    ) as HTMLInputElement
                ).click()
            )

            await page.waitForTimeout(1500)

            await page.waitForSelector(
                '.ytpp-self-certification-questionnaire .ytpp-self-certification-questionnaire #submit-questionnaire-button',
                { visible: true }
            )
            await page.evaluate(() =>
                (
                    document.querySelector(
                        '.ytpp-self-certification-questionnaire .ytpp-self-certification-questionnaire #submit-questionnaire-button'
                    ) as HTMLButtonElement
                ).click()
            )

            await page.waitForXPath(nextBtnXPath)
            next = await page.$x(nextBtnXPath)
            await next[0].click()

            await page.waitForTimeout(1500)
        } catch {}
        messageTransport.debug(`  >> ${videoJSON.title} - Channel monetization set`);
    }

    await sleep(100);
    await page.waitForXPath(nextBtnXPath)
    // click next button
    await sleep(100);
    next = await page.$x(nextBtnXPath)
    await next[0].click()
    await page.waitForXPath(nextBtnXPath)
    // click next button
    await sleep(100);
    next = await page.$x(nextBtnXPath)
    await next[0].click()

    if (videoJSON.publishType) {
        await page.waitForSelector('#privacy-radios *[name="' + videoJSON.publishType + '"]', { visible: true })

        await page.waitForTimeout(1000)

        await page.click('#privacy-radios *[name="' + videoJSON.publishType + '"]');
        messageTransport.debug(`  >> ${videoJSON.title} - Publish type set`);
    }

    // Get publish button
    const publishXPath =
        "//*[normalize-space(text())='Publish']/parent::*[not(@disabled)] | //*[normalize-space(text())='Save']/parent::*[not(@disabled)]"
    await page.waitForXPath(publishXPath)
    // save youtube upload link
    const videoBaseLink = 'https://youtu.be'
    const shortVideoBaseLink = 'https://youtube.com/shorts'
    const uploadLinkSelector = `[href^="${videoBaseLink}"], [href^="${shortVideoBaseLink}"]`
    await page.waitForSelector(uploadLinkSelector)
    const uploadedLinkHandle = await page.$(uploadLinkSelector)

    let uploadedLink
    do {
        await page.waitForTimeout(500)
        uploadedLink = await page.evaluate((e) => e.getAttribute('href'), uploadedLinkHandle)
    } while (uploadedLink === videoBaseLink || uploadedLink === shortVideoBaseLink)

    const closeDialogXPath = uploadAsDraft ? saveCloseBtnXPath : publishXPath
    let closeDialog
    for (let i = 0; i < 10; i++) {
        try {
            closeDialog = await page.$x(closeDialogXPath)
            await closeDialog[0].click()
            break
        } catch (error) {
            await page.waitForTimeout(5000)
        }
    }

    if (videoJSON.isChannelMonetized) {
        try {
            await page.waitForSelector('#dialog-buttons #secondary-action-button', { visible: true })

            await page.click('#dialog-buttons #secondary-action-button')
        } catch {}
    }

    // await page.waitForXPath('//*[contains(text(),"Finished processing")]', { timeout: 0})

    // no closeBtn will show up if keeps video as draft
    if (uploadAsDraft) return uploadedLink

    // Wait for closebtn to show up
    try {
        await page.waitForXPath(closeBtnXPath)
    } catch (e) {
        await browser.close()
        throw new Error(
            'Please make sure you set up your default video visibility correctly, you might have forgotten. More infos : https://github.com/fawazahmed0/youtube-uploader#youtube-setup'
        )
    }

    return uploadedLink
}

export const update = async (
    credentials: Credentials,
    videos: VideoToEdit[],
    puppeteerLaunch?: PuppeteerNodeLaunchOptions,
    messageTransport: MessageTransport = defaultMessageTransport
) => {
    cookiesDirPath = path.join('.', 'yt-auth')
    cookiesFilePath = path.join(
        cookiesDirPath,
        `cookies-${credentials.email.split('@')[0].replace(/\./g, '_')}-${credentials.email
            .split('@')[1]
            .replace(/\./g, '_')}.json`
    )

    await launchBrowser(puppeteerLaunch)
    if (!fs.existsSync(cookiesFilePath)) await loadAccount(credentials, messageTransport)
    const updatedYTLink = []

    for (const video of videos) {
        messageTransport.log(video)
        const link = await updateVideoInfo(video, messageTransport)

        const { onSuccess } = video
        if (typeof onSuccess === 'function') {
            onSuccess(link)
        }

        updatedYTLink.push(link)
    }
    await browser.close()
    return updatedYTLink
}

export const comment = async (
    credentials: Credentials,
    comments: Comment[],
    puppeteerLaunch?: PuppeteerNodeLaunchOptions,
    messageTransport: MessageTransport = defaultMessageTransport
) => {
    cookiesDirPath = path.join('.', 'yt-auth')
    cookiesFilePath = path.join(
        cookiesDirPath,
        `cookies-${credentials.email.split('@')[0].replace(/\./g, '_')}-${credentials.email
            .split('@')[1]
            .replace(/\./g, '_')}.json`
    )

    await launchBrowser(puppeteerLaunch)
    if (!fs.existsSync(cookiesFilePath)) await loadAccount(credentials, messageTransport)
    const commentsS = []

    for (const comment of comments) {
        let result
        messageTransport.log(comment)
        if (comment.live) result = await publishLiveComment(comment, messageTransport)
        else
            result = comment.link.includes('/shorts')
                ? await publishShortComment(comment)
                : await publishComment(comment)

        const { onSuccess } = comment
        if (typeof onSuccess === 'function') {
            onSuccess(result)
        }

        commentsS.push(result)
    }
    await browser.close()
    return commentsS
}

const publishShortComment = async (comment: Comment) => {
    const videoUrl = comment.link
    const cmt = comment.comment
    const cmtBtnXPath = '//*[@id="comments-button"]'
    const cmtInputXPath = '//*[@id="placeholder-area"]'
    if (!videoUrl) {
        throw new Error('The link of the  video is a required parameter')
    }
    await page.goto(videoUrl)
    await sleep(3000)
    try {
        await page.waitForXPath(cmtBtnXPath)
        const cmtBtn = await page.$x(cmtBtnXPath)
        await cmtBtn[0].click()
        await page.waitForXPath(cmtInputXPath)
        const inputArea = await page.$x(cmtInputXPath)
        await inputArea[0].focus()
        await inputArea[0].click()
        await inputArea[0].type(cmt.substring(0, 10000))
        await page.click('#submit-button')
        return { err: false, data: 'sucess' }
    } catch (err) {
        return { err: true, data: err }
    }
}

const publishComment = (comment: Comment) => {
    const videoUrl = comment.link
    if (!videoUrl) {
        throw new Error('The link of the  video is a required parameter')
    }
    return new Promise(async (resolve) => {
        try {
            const cmt = comment.comment
            await page.goto(videoUrl)
            await sleep(2000)
            await scrollTillVeiw(page, `#placeholder-area`)

            await page.focus(`#placeholder-area`)
            const commentBox = await page.$x('//*[@id="placeholder-area"]')
            await commentBox[0].focus()
            await commentBox[0].click()
            await commentBox[0].type(cmt.substring(0, 10000))

            page.exposeFunction('commentResolve', resolve)

            if (comment.pin) {
                // Select the comment list
                const [commentList] = await page.$x(
                    `//ytd-comments[@id="comments"]//ytd-item-section-renderer[@section-identifier="comment-item-section"]/div[@id="contents"]`
                )

                // Register mutation observer for comment list
                await commentList.evaluateHandle((commentList) => {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach(async (mutation) => {
                            if (mutation.addedNodes.length > 0) {
                                try {
                                    // Get the recently added comment node
                                    const comment = mutation.addedNodes[0]

                                    // Finds three dot menu inside comment
                                    // Evaluate XPath relative to the added comment.
                                    // It'd be nice to use Puppeteer's helpers but the MutationObserver returns DOM nodes
                                    const menu = document.evaluate(
                                        `.//div[@id="action-menu"]/ytd-menu-renderer/yt-icon-button`,
                                        comment,
                                        null,
                                        XPathResult.FIRST_ORDERED_NODE_TYPE
                                    ).singleNodeValue
                                    // Expand three dot menu
                                    menu && (menu as HTMLButtonElement).click()

                                    // Wait for menu to expand
                                    await new Promise((resolve) => setTimeout(resolve, 100))

                                    // Select pin button
                                    const pinButton = document.evaluate(
                                        `.//tp-yt-paper-item//*[text()="Pin"]/ancestor::tp-yt-paper-item`,
                                        document,
                                        null,
                                        XPathResult.FIRST_ORDERED_NODE_TYPE
                                    ).singleNodeValue
                                    // Click pin button
                                    pinButton && (pinButton as HTMLButtonElement).click()

                                    // Wait for confirmation dialog
                                    await new Promise((resolve) => setTimeout(resolve, 100))

                                    // Confirm pin
                                    const confirmButton = document.querySelector(
                                        '#confirm-button>yt-button-shape>button'
                                    )
                                    confirmButton && (confirmButton as HTMLButtonElement).click()

                                    // Disconnect observer
                                    observer.disconnect()

                                    // Resolve promise
                                    // @ts-expect-error - commentResolve is exposed to the page
                                    window.commentResolve({ err: false, data: 'sucess' })
                                } catch (err) {
                                    // @ts-expect-error - commentResolve is exposed to the page
                                    window.commentResolve({ err: true, data: err })
                                }
                            }
                        })
                    })

                    observer.observe(commentList, { childList: true })
                })
            }

            await page.click('#submit-button')

            if (comment.pin) {
                // Let mutation observer resolve promise after pinning comment
            } else {
                resolve({ err: false, data: 'sucess' })
            }
        } catch (err) {
            resolve({ err: true, data: err })
        }
    })
}

const publishLiveComment = async (comment: Comment, messageTransport: MessageTransport) => {
    const videoUrl = comment.link
    const cmt = comment.comment
    if (!videoUrl) {
        throw new Error('The link of the  video is a required parameter')
    }
    await page.goto(videoUrl)
    await sleep(3000)
    await scrollTillVeiw(page, `#label`)
    try {
        await page.focus(`#label`)
    } catch (err) {
        messageTransport.log(err)
        throw new Error('Video may not be Live')
    }

    for (let i = 0; i < 6; i++) {
        await autoScroll(page)
    }
    try {
        await page.focus('#input')
        await page.mouse.click(450, 480)
        await page.keyboard.type(cmt.substring(0, 200))
        await sleep(200)
        await page.mouse.click(841, 495)
        return { err: false, data: 'sucess' }
    } catch (err) {
        return { err: true, data: err }
    }
}

const updateVideoInfo = async (videoJSON: VideoToEdit, messageTransport: MessageTransport) => {
    const videoUrl = videoJSON.link
    if (!videoUrl) {
        throw new Error('The link of the  video is a required parameter')
    }

    if (videoJSON.channelName) {
        await changeChannel(videoJSON.channelName)
    }

    const title = videoJSON.title
    const description = videoJSON.description
    const tags = videoJSON.tags
    const Rtags = videoJSON.replaceTags
    const playlistName = videoJSON.playlist
    const videoLang = videoJSON.language
    const gameTitleSearch = videoJSON.gameTitleSearch
    const thumb = videoJSON.thumbnail
    const publish = videoJSON.publishType
    await page.goto(videoUrl)
    const editXpath = '//*[@id="subscribe-button"]/ytd-button-renderer'
    try {
        await page.waitForXPath(editXpath, { timeout: 7000 })
    } catch (err) {
        throw new Error('The video provided may not be yours')
    }

    let edit = await page.$x(editXpath)
    await edit[0].click()
    const titleE = '//*[@id="textbox"]'
    await page.waitForXPath(titleE, { timeout: 70000 })
    await page.waitForFunction('document.querySelectorAll(\'[id="textbox"]\').length > 1')
    const textBoxes = await page.$x('//*[@id="textbox"]')
    await page.bringToFront()
    // Edit the title value (if)
    await textBoxes[0].focus()
    await page.waitForTimeout(1000)
    if (!videoJSON.isNotForKid) {
        await page.click("tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_MFK']").catch(() => {})
    } else if (videoJSON.isAgeRestriction) {
        await page.$eval(`tp-yt-paper-radio-button[name='VIDEO_AGE_RESTRICTION_SELF']`, (e: any) => e.click())
    } else {
        await page.click("tp-yt-paper-radio-button[name='VIDEO_MADE_FOR_KIDS_NOT_MFK']").catch(() => {})
    }
    if (title) {
        // await page.keyboard.down('Control')
        // await page.keyboard.press('A')
        // await page.keyboard.up('Control')
        // await page.keyboard.press('Backspace')
        await textBoxes[0].evaluate((e) => ((e as any).__shady_native_textContent = ''))
        await textBoxes[0].type(title.substring(0, maxTitleLen))
    }
    // Edit the Description content (if)
    if (description) {
        // await textBoxes[1].focus()
        // await page.keyboard.down('Control')
        // await page.keyboard.press('A')
        // await page.keyboard.up('Control')
        // await page.keyboard.press('Backspace')
        await textBoxes[1].evaluate((e) => ((e as any).__shady_native_textContent = ''))
        await textBoxes[1].type(description.substring(0, maxDescLen))
    }
    if (thumb) {
        const [thumbChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 500 }).catch(async () => {
                messageTransport.log('replacing previous thumbanail')
                await page.click('#still-1 > button')
                await page.waitForSelector('#save > div')
                await page.click(`#save > div`)
                await page.waitForXPath("//*[normalize-space(text())='Save']/parent::*[@disabled]")
                await sleep(500)
                return await page.waitForFileChooser()
            }),
            await page.waitForSelector(
                `[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`
            ),
            await page.click(`[class="remove-default-style style-scope ytcp-thumbnails-compact-editor-uploader"]`)
        ])
        await thumbChooser.accept([thumb])
    }
    // await sleep( 10000000)
    const playlist = await page.$x(
        `//*[@id="basics"]/div[4]/div[3]/div[1]/ytcp-video-metadata-playlists/ytcp-text-dropdown-trigger/ytcp-dropdown-trigger/div/div[3]`
    )
    let createplaylistdone
    if (playlistName) {
        for (let i = 0; i < 2; i++) {
            try {
                await page.evaluate((el) => el.click(), playlist[0])
                await page.waitForSelector('#search-input')
                await page.focus(`#search-input`)
                await page.type(`#search-input`, playlistName)

                const escapedPlaylistName = escapeQuotesForXPath(playlistName)
                const playlistToSelectXPath = '//*[normalize-space(text())=' + escapedPlaylistName + ']'

                await page.waitForXPath(playlistToSelectXPath, { timeout: 10000 })
                const playlistNameSelector = await page.$x(playlistToSelectXPath)
                await page.evaluate((el) => el.click(), playlistNameSelector[0])
                createplaylistdone = await page.$x("//*[normalize-space(text())='Done']")
                await page.evaluate((el) => el.click(), createplaylistdone[0])
                break
            } catch (error) {
                await page.evaluate((el) => el.click(), playlist[0])
                const newPlaylistXPath =
                    "//*[normalize-space(text())='New playlist'] | //*[normalize-space(text())='Create playlist']"
                await page.waitForXPath(newPlaylistXPath)
                const createplaylist = await page.$x(newPlaylistXPath)
                await page.evaluate((el) => el.click(), createplaylist[0])
                await page.keyboard.type(' ' + playlistName.substring(0, 148))
                const createplaylistbtn = await page.$x("//*[normalize-space(text())='Create']")
                await page.evaluate((el) => el.click(), createplaylistbtn[1])
                createplaylistdone = await page.$x("//*[normalize-space(text())='Done']")
                await page.evaluate((el) => el.click(), createplaylistdone[0])
            }
        }
    }
    const moreOption = await page.$x("//*[normalize-space(text())='Show more']")
    await moreOption[0].click()
    if (tags) {
        await page.focus(`[aria-label="Tags"]`)
        await page.type(`[aria-label="Tags"]`, tags.join(', ').substring(0, 495) + ', ')
    }
    if (Rtags) {
        await page.click('//*[@id="clear-button"]/tp-yt-iron-icon')
        await page.focus(`[aria-label="Tags"]`)
        await page.type(`[aria-label="Tags"]`, Rtags.join(', ').substring(0, 495) + ', ')
    }
    if (videoLang) {
        const langHandler = await page.$x("//*[normalize-space(text())='Video language']")
        await page.evaluate((el) => el.click(), langHandler[0])
        const langName = await page.$x(
            '//*[normalize-space(translate(text(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"))=\'' +
                videoLang.toLowerCase() +
                "']"
        )
        await page.evaluate((el) => el.click(), langName[langName.length - 1])
    }
    // Setting Game Title ( Will also set Category to gaming )
    if (gameTitleSearch) {
        await selectGame(page, gameTitleSearch, messageTransport, videoJSON.gameSelector)
    }

    await page.focus(`#content`)
    if (publish) {
        await page.click(`#content`)
        // await page.click(`#onRadio`);
        const publishBtn = await page.$x('//*[@id="first-container"]')
        await sleep(2000)
        // publishBtn[0].click()
        try {
            switch (publish) {
                case 'private':
                    await page
                        .click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(2)`)
                        .catch(
                            async (err) =>
                                await page.click(
                                    `#privacy-radios > tp-yt-paper-radio-button.style-scope.ytcp-video-visibility-select.iron-selected`
                                )
                        )
                    break
                case 'unlisted':
                    await page
                        .click(
                            `#privacy-radios > tp-yt-paper-radio-button.style-scope.ytcp-video-visibility-select.iron-selected`
                        )
                        .catch(
                            async (err) => await page.click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(11)`)
                        )
                    break
                case 'public':
                    await page
                        .click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(15)`)
                        .catch(
                            async (err) => await page.click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(16)`)
                        )
                    break
                case 'public&premiere':
                    await page.click(`#privacy-radios > tp-yt-paper-radio-button:nth-child(15)`)
                    await page.click(`#enable-premiere-checkbox`)
                    break
            }
        } catch (err) {
            messageTransport.log('already selected')
            await page.keyboard.press('Escape')
        }
        await page.click(`#save-button`)
        await sleep(1200)
    }
    try {
        await page.focus(`#content`)
        await page.focus(`#save > div`)

        await page.waitForSelector('#save > div')
        await page.click(`#save > div`)
        await page.waitForXPath("//*[normalize-space(text())='Save']/parent::*[@disabled]")
    } catch (err) {
        messageTransport.log(err)
        throw new Error('Probably nothing was changed ...')
    }
    //#overflow-menu-button
    return messageTransport.log('successfully edited')
}

async function loadAccount(
    credentials: Credentials,
    messageTransport: MessageTransport,
    useCookieStore: boolean = true
) {
    try {
        if (!fs.existsSync(cookiesFilePath) || !useCookieStore)
            await login(page, credentials, messageTransport, useCookieStore)
    } catch (error: any) {
        if (error.message === 'Recapcha found') {
            if (browser) {
                await browser.close()
            }
            throw error
        }

        // Login failed trying again to login
        try {
            await login(page, credentials, messageTransport, useCookieStore)
        } catch (error) {
            if (browser) {
                await browser.close()
            }
            throw error
        }
    }
    try {
        await changeHomePageLangIfNeeded(page)
    } catch (error) {
        messageTransport.log(error)
        await login(page, credentials, messageTransport, useCookieStore)
    }
}

async function changeLoginPageLangIfNeeded(localPage: Page) {
    const selectedLangSelector = '[aria-selected="true"]'
    try {
        await localPage.waitForSelector(selectedLangSelector)
    } catch (e: any) {
        throw new Error('Failed to find selected language : ' + e.name)
    }

    const selectedLang = await localPage.evaluate(
        (selectedLangSelector: any) => document.querySelector(selectedLangSelector).innerText,
        selectedLangSelector
    )

    if (!selectedLang) {
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
    } catch (e: any) {
        throw new Error('Failed to find english language item : ' + e.name)
    }

    await localPage.click(englishLangItemSelector)

    await localPage.waitForTimeout(1000)
}

async function changeHomePageLangIfNeeded(localPage: Page) {
    await localPage.goto(homePageURL)

    const avatarButtonSelector = 'button#avatar-btn'

    try {
        await localPage.waitForSelector(avatarButtonSelector)
    } catch (e: any) {
        throw new Error('Avatar/Profile picture button not found : ' + e.name)
    }

    await localPage.click(avatarButtonSelector)

    const langMenuItemSelector =
        '#sections>yt-multi-page-menu-section-renderer:nth-child(3)>#items>ytd-compact-link-renderer:nth-of-type(2)>a'
    try {
        await localPage.waitForSelector(langMenuItemSelector)
    } catch (e: any) {
        throw new Error('Language menu item selector/button(">") not found : ' + e.name)
    }

    const selectedLang = await localPage.evaluate(
        (langMenuItemSelector) => document.querySelector(langMenuItemSelector).innerText,
        langMenuItemSelector
    )

    if (!selectedLang) {
        throw new Error('Failed to find selected language : Empty text')
    }

    if (selectedLang.includes('English')) {
        await localPage.goto(uploadURL)

        return
    }

    await localPage.click(langMenuItemSelector)

    const englishItemXPath = "//*[normalize-space(text())='English (UK)']"

    try {
        await localPage.waitForXPath(englishItemXPath)
    } catch (e: any) {
        throw new Error('English(UK) item selector not found : ' + e.name)
    }

    await localPage.waitForTimeout(3000)

    await localPage.evaluate((englishItemXPath: any) => {
        let element: HTMLElement = document?.evaluate(
            englishItemXPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue as HTMLElement
        element.click()
    }, englishItemXPath)
    //Recursive language change, if YouTube, for some reason, did not change the language the first time, although the English (UK) button was pressed, the exit from the recursion occurs when the selectedLang selector is tested for the set language
    await changeHomePageLangIfNeeded(localPage)
}

async function launchBrowser(puppeteerLaunch?: PuppeteerNodeLaunchOptions, loadCookies: boolean = true) {
    browser = await puppeteer.launch(puppeteerLaunch)
    page = await browser.newPage()
    await page.setDefaultTimeout(timeout)

    if (loadCookies) {
        const previousSession = fs.existsSync(cookiesFilePath)

        if (previousSession) {
            // If file exist load the cookies
            const cookiesString = fs.readFileSync(cookiesFilePath, { encoding: 'utf-8' })
            const parsedCookies = JSON.parse(cookiesString)
            if (parsedCookies.length !== 0) {
                for (let cookie of parsedCookies) {
                    await page.setCookie(cookie)
                }
            }
        }
    }

    await page.setViewport({ width: width, height: height })
}

async function login(
    localPage: Page,
    credentials: Credentials,
    messageTransport: MessageTransport,
    useCookieStore: boolean = true
) {
    await localPage.goto(uploadURL)

    if (!useCookieStore) {
        try {
            // Check if already logged in if we don't use normal cookie store
            await localPage.waitForSelector('button#avatar-btn', {
                timeout: 15 * 1000
            })

            messageTransport.log(`Account already logged in`)

            return
        } catch {}
    }

    await changeLoginPageLangIfNeeded(localPage)

    const emailInputSelector = 'input[type="email"]'
    await localPage.waitForSelector(emailInputSelector)

    await localPage.type(emailInputSelector, credentials.email, { delay: 50 })
    await localPage.keyboard.press('Enter')

    // check if 2fa code was sent to phone
    await localPage.waitForNavigation()
    await localPage.waitForTimeout(1000)
    const googleAppAuthSelector = 'samp'
    const isOnGoogleAppAuthPage = await localPage.evaluate(
        (authCodeSelector) => document.querySelector(authCodeSelector) !== null,
        googleAppAuthSelector
    )

    if (isOnGoogleAppAuthPage) {
        const codeElement = await localPage.$('samp')
        const code = (await codeElement?.getProperty('textContent'))?.toString().replace('JSHandle:', '')
        code && messageTransport.userAction('Press ' + code + ' on your phone to login')
    }
    // password isnt required in the case that a code was sent via google auth
    else {
        const passwordInputSelector = 'input[type="password"]:not([aria-hidden="true"])'
        await localPage.waitForSelector(passwordInputSelector)
        await localPage.waitForTimeout(3000)
        await localPage.type(passwordInputSelector, credentials.pass, { delay: 50 })

        await localPage.keyboard.press('Enter')
    }

    try {
        await localPage.waitForNavigation()
        await localPage.waitForTimeout(1000)

        // check if sms code was sent
        const smsAuthSelector = '#idvPin'
        const isOnSmsAuthPage = await localPage.evaluate(
            (smsAuthSelector) => document.querySelector(smsAuthSelector) !== null,
            smsAuthSelector
        )
        if (isOnSmsAuthPage) {
            try {
                if (!messageTransport.onSmsVerificationCodeSent)
                    throw new Error('onSmsVerificationCodeSent not implemented')

                let code = await messageTransport.onSmsVerificationCodeSent()

                if (!code) throw new Error('Invalid SMS Code')

                await localPage.type(smsAuthSelector, code.trim())
                await localPage.keyboard.press('Enter')
            } catch (error) {
                await browser.close()
                throw error
            }
        }
    } catch (error: any) {
        const recaptchaInputSelector = 'input[aria-label="Type the text you hear or see"]'

        const isOnRecaptchaPage = await localPage.evaluate(
            (recaptchaInputSelector) => document.querySelector(recaptchaInputSelector) !== null,
            recaptchaInputSelector
        )

        if (isOnRecaptchaPage) {
            throw new Error('Recaptcha found')
        }

        throw new Error(error)
    }
    //create channel if not already created.
    try {
        await localPage.click('#create-channel-button')
        await localPage.waitForTimeout(3000)
    } catch (error) {
        messageTransport.log('Channel already exists or there was an error creating the channel.')
    }
    try {
        const uploadPopupSelector = 'ytcp-uploads-dialog'
        await localPage.waitForSelector(uploadPopupSelector, { timeout: 70000 })
    } catch (error) {
        if (credentials.recoveryemail) await securityBypass(localPage, credentials.recoveryemail, messageTransport)
    }

    if (useCookieStore) {
        const cookiesObject = await localPage.cookies()
        await fs.mkdirSync(cookiesDirPath, { recursive: true })
        // Write cookies to temp file to be used in other profile pages
        await fs.writeFile(cookiesFilePath, JSON.stringify(cookiesObject), function (err) {
            if (err) {
                messageTransport.log('The file could not be written. ' + err.message)
            }
            messageTransport.log('Session has been successfully saved')
        })
    } else {
        messageTransport.log('Account logged in successfully')
    }
}

// Login bypass with recovery email
async function securityBypass(localPage: Page, recoveryemail: string, messageTransport: MessageTransport) {
    try {
        const confirmRecoveryXPath = "//*[normalize-space(text())='Confirm your recovery email']"
        await localPage.waitForXPath(confirmRecoveryXPath)

        const confirmRecoveryBtn = await localPage.$x(confirmRecoveryXPath)
        await localPage.evaluate((el: any) => el.click(), confirmRecoveryBtn[0])
    } catch (error) {
        messageTransport.log(error)
    }

    await localPage.waitForNavigation({
        waitUntil: 'networkidle0'
    })
    const enterRecoveryXPath = "//*[normalize-space(text())='Enter recovery email address']"
    await localPage.waitForXPath(enterRecoveryXPath)
    await localPage.waitForTimeout(5000)
    await localPage.focus('input[type="email"]')
    await localPage.waitForTimeout(3000)
    await localPage.type('input[type="email"]', recoveryemail, { delay: 100 })
    await localPage.keyboard.press('Enter')
    await localPage.waitForNavigation({
        waitUntil: 'networkidle0'
    })
    const uploadPopupSelector = 'ytcp-uploads-dialog'
    await localPage.waitForSelector(uploadPopupSelector, { timeout: 60000 })
}

async function sleep(ms: number) {
    return new Promise((sendMessage) => setTimeout(sendMessage, ms))
}

async function autoScroll(page: Page) {
    await page.evaluate(`(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve(0);
                }
            }, 100);
        });
    })()`)
}

async function scrollTillVeiw(page: Page, element: string) {
    let sc = true
    while (sc) {
        try {
            await page.focus(element)
            sc = false
        } catch (err) {
            await autoScroll(page)
            sc = true
        }
    }
    return
}

async function changeChannel(channelName: string) {
    await page.goto('https://www.youtube.com/channel_switcher')

    const channelNameXPath = `//*[normalize-space(text())='${channelName}']`
    const element = await page.waitForXPath(channelNameXPath)

    await element!.click()

    await page.waitForNavigation({
        waitUntil: 'networkidle0'
    })
}

function escapeQuotesForXPath(str: string) {
    // If the value contains only single or double quotes, construct
    // an XPath literal
    if (!str.includes('"')) {
        return '"' + str + '"'
    }
    if (!str.includes("'")) {
        return "'" + str + "'"
    }
    // If the value contains both single and double quotes, construct an
    // expression that concatenates all non-double-quote substrings with
    // the quotes, e.g.:
    //
    //    concat("foo",'"',"bar")

    const parts: string[] = []
    // First, put a '"' after each component in the string.
    for (const part of str.split('"')) {
        if (part.length > 0) {
            parts.push('"' + part + '"')
        }
        parts.push("'\"'")
    }
    // Then remove the extra '"' after the last component.
    parts.pop()
    // Finally, put it together into a concat() function call.

    return 'concat(' + parts.join(',') + ')'
}

function xpathTextSelector(text: string, caseSensitive?: boolean, nthElement?: number) {
    let xpathSelector = ''
    if (caseSensitive) xpathSelector = `//*[contains(normalize-space(text()),"${text}")]`
    else {
        let uniqueText = [...new Set(text.split(''))].join('')
        xpathSelector = `//*[contains(translate(normalize-space(text()),'${uniqueText.toUpperCase()}','${uniqueText.toLowerCase()}'),"${text
            .toLowerCase()
            .replace(/\s\s+/g, ' ')}")]`
    }
    if (nthElement) xpathSelector = `(${xpathSelector})[${nthElement + 1}]`

    return xpathSelector
}

async function selectGame(page: Page, gameTitle: string, messageTransport: MessageTransport, gameSelector?: (arg0: GameData) => Promise<boolean> | null): Promise<boolean> {
    const categoryDiv = await page.$('#category-container')
    if (categoryDiv == null) {
        messageTransport.warn(`selectGame: categoryDiv is null.`)
        return false;
    }

    // Press drop down to populate choices.
    const categoryDropdownToggle = await categoryDiv.$('#category > ytcp-select > ytcp-text-dropdown-trigger')
    await categoryDropdownToggle?.click()
    await sleep(1000)

    const gamingCategoryButton = await page.$("[test-id='CREATOR_VIDEO_CATEGORY_GADGETS']")
    if (!gamingCategoryButton) {
        messageTransport.warn(`selectGame: Gaming category button not found.`)
        return false;
    }

    await gamingCategoryButton.click()
    await sleep(500)

    // Wait for input.
    const gameTitleBox = await categoryDiv.$('.ytcp-form-gaming input')
    if (gameTitleBox == null) {
        messageTransport.warn(`selectGame: gameTitleBox is null.`)
        return false;
    }

    // Type and call the game selector delegate.
    await gameTitleBox.focus()
    await gameTitleBox.type(gameTitle)

    // Wait for options.
    const optionsSelectorHost = "#search-results > tp-yt-paper-dialog:not([aria-hidden='true'])"
    const optionsPopupHost = await page.waitForSelector(optionsSelectorHost)
    if (optionsPopupHost == null) {
        messageTransport.warn(`selectGame: optionsPopupHost is null.`);
        return false;
    }

    const buttonOptions = await optionsPopupHost.$$('.selectable-item')

    // Check if we should select the option.
    let pressed = false
    for (let i = 0; i < buttonOptions.length; i++) {
        const button = buttonOptions[i]

        let testId = await button.evaluate((el: Element) => el.getAttribute('test-id'))
        if (testId == null || !testId.startsWith(`{"title"`)) continue

        let gameData = JSON.parse(testId) as GameData
        if (gameSelector !== undefined && gameSelector !== null && !(await gameSelector(gameData))) continue

        await button.click()
        pressed = true;
        break
    }

    if (!pressed && buttonOptions.length != 0) {
        // Just select none.
        await buttonOptions[0].click();
        return false;
    }
    return true;
}
