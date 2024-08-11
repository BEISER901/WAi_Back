#!/usr/bin/env -S node --no-warnings

// ./start.js

const openedClient = {}

const Client = require("./WhatsApp_Client/src/Client.js")
const qrcode = require('qrcode-terminal')

const clientsOpened = {}

const startClient = async (clientId, qrCallback, readyCallback) => {
    const client = new Client()

    // If clientId undefined or null will create new clientId.
    clientsOpened[clientId]={
        info: {
            "loading": true 
        } 
    }

    client.id = clientId

    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        qrcode.generate(qr, {small: true})
        qrCallback(qr, client.id)
        clientsOpened[clientId]={
            info: {
                id: client.id,
                qr: qr 
            },
            client: client 
        }
    });

    client.on('ready', async () => {
        clientsOpened[clientId]={
            info: {
                id: client.id
            },
            client: client 
        }
        readyCallback(client.id)
        
        // chats[index] index is where chat you have get, index - 0 is first chat in your list.
/*        await client.openChat(chats[0].name)*/
/*        console.log(await client.getCurrentChatName())
        console.log((await client.getAllMessages()).length)*/
        /*client.destroy()*/
    });

    await client.initialize();


    if(clientId){
        console.log("User configuration with indicator: " + clientId)
    }else{
        console.log("A new client with the identifier: " + client.id)
    }
}

const express = require('express');
const app = express();

app.get('/:clientid', (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    if(clientsOpened[req.params?.clientid]){
        res.send(clientsOpened[req.params?.clientid].info)
    }else{        
        startClient(req.params?.clientid, (qr, id)=>{
            res.send({id, qr})
        }, (id)=>{
            try{res.send({ id })}catch(e){}
        })
    }
})

app.get('/:clientid/chats', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr){
        const chats = await clientsOpened[req.params?.clientid].client.getChats()
        res.send(chats)
    }else{
        startClient(req.params?.clientid, (qr, id)=>{
            res.send(`Клиент ${req.params?.clientid} не аутефицирован`)
        }, async (id)=>{
            const chats = await clientsOpened[id].client.getChats()
            res.send(chats)
        })
    }
})

app.get('/:clientid/chats/:chatid/messages', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr){
        const chat = await clientsOpened[req.params?.clientid].client.getChatById(req.params?.chatid)
        await clientsOpened[req.params?.clientid].client.openChat(chat.id.user, chat.name)
        res.send({chat_name: await clientsOpened[req.params?.clientid].client.getCurrentChatName(), messages: await clientsOpened[req.params?.clientid].client.getAllMessages()})
    }else{
        startClient(req.params?.clientid, (qr, id)=>{
            res.send(`Клиент ${req.params?.clientid} не аутефицирован`)
        }, async (id)=>{
            const chat = await clientsOpened[id].client.getChatById(req.params?.chatid)
            await clientsOpened[id].client.openChat(chat.id.user, chat.name)
            res.send({chat_name: await clientsOpened[id].client.getCurrentChatName(), messages: await clientsOpened[id].client.getAllMessages()})
        })
    }
})

app.listen(3000)