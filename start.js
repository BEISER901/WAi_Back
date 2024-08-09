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
    const chats = await client.getChats()
    // chats[index] index is where chat you have get, index - 0 is first chat in your list.
    await client.openChat(chats[0].name)
    console.log(await client.getCurrentChatName())
    console.log(await client.getAllMessages())
});


client.initialize();