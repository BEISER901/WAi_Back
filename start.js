#!/usr/bin/env -S node --no-warnings --env-file=.env

// ./start.js


const clientsOpened = {}

const Client = require("./WhatsApp_Client/src/Client.js")
const GPTClient = require("./GPT_Client/Client.js")
const qrcode = require('qrcode-terminal')

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
        if(readyCallback)readyCallback(client.id)
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
        try{res.send(clientsOpened[req.params?.clientid].info)}catch(e){}
    }else{        
        startClient(req.params?.clientid, (qr, id)=>{
            try{res.send({id, qr})}catch(e){}
        }, (id)=>{
            try{try{res.send({ id })}catch(e){}}catch(e){}
        })
    }
})

app.get('/:clientid/chats', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr && clientsOpened[req.params?.clientid]?.client){
        const chats = await clientsOpened[req.params?.clientid].client.getChats()
        res.send(chats)
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})

app.get('/:clientid/chats/:chatid/messages', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr  && clientsOpened[req.params?.clientid]?.client){
        const chat = await clientsOpened[req.params?.clientid].client.getChatById(req.params?.chatid)
        const msgs = await chat.fetchMessages({limit: 10000})
        try{res.send(msgs)}catch(e){}
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})

app.get('/:clientid/openai_init', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr  && clientsOpened[req.params?.clientid]?.client){
        const chats = await clientsOpened[req.params?.clientid].client.getChats()
        const chat = await clientsOpened[req.params?.clientid].client.getChatById(chats[1].id._serialized)
        const msgs = await chat.fetchMessages({limit: 10000})
        let daysMsg = null
        let countExample = 1
        const gptclient = new GPTClient()
        const stringMsgs = msgs.map(msg=>{
            const currentDaysMsg = parseInt((new Date(msg.timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))
            var example = `${msg.fromMe?"Пользователь 1:": "Пользователь 2:"} ${msg.body}`
            if(currentDaysMsg != daysMsg){
                example = `Пример ${countExample}:\n` + example
                daysMsg = currentDaysMsg
                countExample++
            }
            return example
        }).join("\n")
        await gptclient.Learn(
            stringMsgs,
            5,
            200
        ).then(console.log)
        try{res.send({status: "in_progress"})}catch(e){}
    }else{
        res.send(`Клиент ${req.params?.clientid} не аутефицирован`)
    }
})

app.listen(3000)