#!/usr/bin/env -S node --no-warnings

// ./start.js

const Client = require("./src/Client.js")
const qrcode = require('qrcode-terminal')
const client = new Client()

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
	qrcode.generate(qr, {small: true})
});

client.on('ready', async () => {
    const page = client.pupPage;
    const arrChats = await page.evaluate(() => {
    	return Array.from(document.querySelectorAll("#pane-side  > *")[2].querySelectorAll("div._ak8q")).map(el=>el.innerText)
    })
    console.log(arrChats)
});


client.initialize();