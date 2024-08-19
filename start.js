#!/usr/bin/env -S node --no-warnings --env-file=.env

const initHeaders = (res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
}

// ./start.js

const clientsOpened = {}

const Client = require("./WhatsApp_Client/src/Client.js")
const GPTClient = require("./GPT_Client/Client.js")
const qrcode = require('qrcode-terminal')

const express = require('express');
const app = express();

async function delay(ms) {
  // return await for better async stack trace support in case of errors.
  return await new Promise(resolve => setTimeout(resolve, ms));
}

const startClient = async (clientId, onStatusChange) => {
    const client = new Client()

    // If clientId undefined or null will create new clientId.

    client.id = clientId

    client.on('launch', () => {
        // Generate and scan this code with your phone
        clientsOpened[client.id]={
            info: {
                id: client.id,
                status: "launch"
            },
            client: client
        }
        if(onStatusChange)onStatusChange(client.id, "launch")
    })

    client.on('loading_screen', () => {
        // Generate and scan this code with your phone
        clientsOpened[client.id]={
            info: {
                id: client.id,
                status: "loading"
            },
            client: client 
        }
        if(onStatusChange)onStatusChange(client.id, "loading_screen")
    })

    client.on('generate_id', () => {
        // Generate and scan this code with your phone
        clientsOpened[client.id]={
            info: {
                id: client.id,
                status: "generate_id"
            },
            client: client 
        }
        if(onStatusChange)onStatusChange(client.id, "generate_id")
    })

    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        qrcode.generate(qr, {small: true})
        clientsOpened[client.id]={
            info: {
                id: client.id,
                status: "qr",
                qr: qr 
            },
            client: client 
        }
        if(onStatusChange)onStatusChange(client.id, "qr")
    })

    client.on('ready', async () => {
        clientsOpened[client.id]={
            info: {
                id: client.id,
                status: "ready"
            },
            client: client,
            isReady: true
        }
        if(onStatusChange)onStatusChange(client.id, "ready")
    })

    await client.initialize();


    if(clientId){
        console.log("User configuration with indicator: " + clientId)
    }else{
        console.log("A new client with the identifier: " + client.id)
    }
}

app.get('/:clientid', async (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    if(clientsOpened[req.params?.clientid]){
        try{res.send(clientsOpened[req.params?.clientid].info)}catch(e){}
    }else{   
        startClient(req.params?.clientid=="auto"?undefined:req.params?.clientid, (clientid)=>{
            try{res.send(clientsOpened[clientid].info)}catch(e){}
        })
    }
})

// Return all chats 

app.get('/:clientid/chats', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return;
    initHeaders(res)

    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr && clientsOpened[req.params?.clientid]?.client){
        const chats = await clientsOpened[req.params?.clientid].client.getChats()
        try{res.send(chats.map(chat=>({userId: chat.id.user, name: chat.name})))}catch(e){}
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})
app.get('/:clientid/state', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return;
    initHeaders(res)

    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr && clientsOpened[req.params?.clientid]?.client){
        const state = await clientsOpened[req.params?.clientid].client.getState()
        try{res.send(state)}catch(e){}
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})

// Return all messages  

app.get('/:clientid/chats/:chatid/messages', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    initHeaders(res)

    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr  && clientsOpened[req.params?.clientid]?.client){
        const chat = await clientsOpened[req.params?.clientid].client.getChatById(req.params?.chatid)
        const msgs = await chat.fetchMessages({limit: 10000})
        try{res.send(msgs)}catch(e){}
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})

app.get('/:clientid/info', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    initHeaders(res)

    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr  && clientsOpened[req.params?.clientid]?.client){
        try{res.send(clientsOpened[req.params?.clientid].client.info)}catch(e){}
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})

/*app.get('/:clientid', (req, res, next) => {
    initHeaders(res)
    if(clientsOpened[req.params?.clientid]){
        clientsOpened[req.params?.clientid].client.destroy()
        clientsOpened[req.params?.clientid].client.removeClientFolder()
        console.log("Удален клиент с индетификатором: " + req.params?.clientid)
    }else{
        Client.removeClientFolderById(req.params?.clientid)
        console.log("Удален клиент с индетификатором: " + req.params?.clientid)
    }
})
*/
// Transferring chats to artificial intelligence 

// app.get('/:clientid/init', async (req, res) => {
//     if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
//     initHeaders(res)

//     const body = (()=>{try{JSON.parse(req.body)}catch(e){}})

//     if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr  && clientsOpened[req.params?.clientid]?.client){
//         const chatsMsg = (await clientsOpened[req.params?.clientid].client.getChats()).filter(chat=>!body.filter.includes(chats.id._serialized)).map(chat=>{
//             const msgs = await chat.fetchMessages({limit: 10000})
//             return msgs.map(msg=>({ content: msg.body, timestamp: msg.timestamp, fromMe: msg.fromMe })
// /*            let daysMsg = null
//             let countExample = 1
//             const gptclient = new GPTClient()
//             const stringMsgs = msgs.map(msg=>{
//                 const currentDaysMsg = parseInt((new Date(msg.timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))
//                 var example = `${msg.fromMe?"Пользователь 1:": "Пользователь 2:"} ${msg.body}`
//                 if(currentDaysMsg != daysMsg){
//                     example = `Пример ${countExample}:\n` + example
//                     daysMsg = currentDaysMsg
//                     countExample++
//                 }
//                 return example
//             }).join("\n")
//             await gptclient.Learn(
//                 stringMsgs,
//                 5,
//                 200
//             ).then(console.log)
//             try{res.send({status: "in_progress"})}catch(e){}*/
//         })
//     }else{
//         res.send(`Клиент ${req.params?.clientid} не аутефицирован`)
//     }
// })

// Wait for on('ready'... event
 
app.get('/:clientid/waitForStatusChange', async (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    initHeaders(res)

    if(clientsOpened[req.params?.clientid]?.client){
        ["ready", "loading_screen", "launch", "qr", "generate_id"].map(event=>{
            clientsOpened[req.params?.clientid]?.client.on(event, (qr) => {
                try{res.send(clientsOpened[req.params?.clientid].info)}catch(e){}
            })
        })
    }
})

// Launch on port 3000 

app.listen(3000)