#!/usr/bin/env -S node --no-warnings

// ./start.js

const Client = require("./WhatsApp_Client/src/Client.js")
const qrcode = require('qrcode-terminal')

const startClient = async (clientId) => {
    const client = new Client()

    // If clientId undefined or null will create new clientId.
    client.id = clientId

    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        qrcode.generate(qr, {small: true})
    });

    client.on('ready', async () => {
        const chats = await client.getChats()
        // chats[index] index is where chat you have get, index - 0 is first chat in your list.
        await client.openChat(chats[1].name)
        console.log(await client.getCurrentChatName())
        console.log((await client.getAllMessages()).length)
        client.destroy()
    });

    await client.initialize();

    if(clientId){
        console.log("User configuration with indicator: " + clientId)
    }else{
        console.log("A new client with the identifier: " + client.id)
    }
}
startClient()