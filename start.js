#!/usr/bin/env -S node --no-warnings

// ./start.js

const Client = require("./src/Client.js")
const qrcode = require('qrcode-terminal')
const client = new Client()

client.id = "kbqogin8h4a"

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
	qrcode.generate(qr, {small: true})
});

client.on('ready', async () => {
    /*console.log(await client.getChatLabels("77052115569@c.us"))*/
    const chat = await client.getMessageById("true_77071911700@c.us_3EB008926FCC54BB07D507_out")
    console.log(chat)
/*    const chats = await client.getChats()
    console.log(chats[0])*/
/*    console.log(chat.lastMessage._data.id)*/
});


client.initialize();