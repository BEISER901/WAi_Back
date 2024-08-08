#!/usr/bin/env -S node --no-warnings

// ./start.js

const Client = require("./src/Client.js")
const qrcode = require('qrcode-terminal')
const client = new Client()

client.id = null

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
	qrcode.generate(qr, {small: true})
});

client.on('ready', async () => {
/*    const page = client.pupPage;
    const arrChats = await page.evaluate(() => {
    	return Array.from(document.querySelectorAll("#pane-side  > *")[2].querySelectorAll("div._ak8q")).map(el=>el.innerText)
    })*/
    const chats = await client.getChats()
    console.log(chats[0])
    const chat = await client.getChatById("77052115569@c.us")
    console.log(chat.lastMessage._data.id)
});


client.initialize();