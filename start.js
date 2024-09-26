#!/usr/bin/env -S node --no-warnings --env-file=.env

const initHeaders = (res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods", "*");
}

const convertTextTagsToText = (firstTag, lastTag, text, func) => {
    let indexTextTag = -1
    const arr = text.split(firstTag).flatMap((el, idx)=>{
        const json = (()=>{try{return JSON.parse(el.split(lastTag)[0])}catch(e){}})()
        const value =   el.includes(lastTag)?
                            json??el.split(lastTag)[0]
                        :
                            null
        if(value)indexTextTag+=1
        return (     
            value?
                (func(value, indexTextTag) + (el.split(lastTag)[1]??""))
            :el                                  
        )
    })
    return arr.filter(v=>v).join("")
}

// ./start.js

const clientsOpened = {}

const WAUtil = require('./WhatsApp_Client/src/util/Util');
const Client = require("./WhatsApp_Client/src/Client.js")
const GPTClient = require("./GPT_Client/Client.js")
const qrcode = require('qrcode-terminal')
var bodyparser = require('body-parser')
const { createClient } = require('@supabase/supabase-js')

const express = require('express');
const app = express();
const cors = require('cors');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

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
        if(client.statusInfo.recentMsgsSynced){
            const gptclient = new GPTClient()
            await gptclient.startTraning(client, supabase)
        }
    })
    client.on("recent_msg_synced", async ()=>{
        const gptclient = new GPTClient()
        await gptclient.startTraning(client, supabase)
    })

    await client.initialize();

    if(clientId){
        console.log("Running user with identifier: " + clientId)
    }else{
        console.log("A new client with the identifier: " + client.id)
    }

    client.on('message', async (reqmsg) => {
        const { data } = await supabase.from("AI_Examples").select("example_for_ai, dont_follow_chats, additionally").eq("clientid", client.id);
        clientsOpened[client.id]={
            ...clientsOpened[client.id],
            lastMessage: {
                ...(clientsOpened[client.id].lastMessage??{}),
                [reqmsg.from]: reqmsg.body
            }
        }
        const clientInfo = (await supabase.from("Clients").select().eq("clientid", client.id)).data[0]
        let pattern = convertTextTagsToText("<text!>", "<!text>", clientInfo.patternText, (content)=>{
            return `\n${content.name}:"${content.value}"\n`
        })
        pattern = convertTextTagsToText("<list!>", "<!list>", pattern, (content)=>{
            return convertTextTagsToText("<listitem!>", "<!listitem>", content, (content, index)=>{
                return `${index==0?"\n":""}${index+1}) ${convertTextTagsToText("<textrow!>", "<!textrow>", content, ({name, value})=>{
                    return `\n${name}:"${value}"` 
                })}\n`
            })
        })
        console.log(reqmsg.from  == "77071911700@c.us")
        if(clientInfo.active)if(process.env.debug == "true"?reqmsg.from == "77071911700@c.us":!(data?.[0]?.dont_follow_chats??[]).includes(reqmsg.from)){
            const chat = await client.getChatById(reqmsg.from)
            await chat.sendStateTyping()
            const gptclient = new GPTClient()
            const chat_msgs = await chat.fetchMessages({limit: 1000000})
            console.log(123)
            const answer = await gptclient.Answer(
                client.info.pushname,
                client.info.pushname,
                reqmsg.body,
                new Date(),
                null,
                pattern,
                chat_msgs.map(msg=>({content: msg.body, fromMe: msg.fromMe, timestamp: msg.timestamp})),
                supabase,
                client
            )
            const msgs = answer.split("//newmessage//").filter(msg=>msg!="")
            for(const index in msgs){  
                if(clientsOpened[client.id]?.lastMessage?.[reqmsg.from] != reqmsg.body){
                    console.log("break")
                    break
                }     
                // console.log(msgs)         
                var msg = msgs?.[index]??""
                if(msg!=""){
                    if(!msg.includes("__url-")){
                        await delay((msg?.length??0)*150)
                    }else{
                        msg = msg.replace("__url-", "").replace("__url", "")
                    }
                    await client.sendMessage(reqmsg.from, msg);
                }
            }
            await chat.clearState()
        }
    })
}

const startAllClients = () => {
    WAUtil.getAllClientsFoldersId().map(id=>{
        startClient(id)
    })
}

startAllClients()

app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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
    if(clientsOpened[req.params?.clientid]?.client){
        const chats = (await clientsOpened[req.params?.clientid].client.getChats()).filter(chat=>!(req?.body?.filter??[]).includes(chat.id._serialized))
        try{res.send(chats.map(chat=>({userId: chat.id.user, name: chat.name, serialized: chat.id._serialized})))}catch(e){}
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})

app.post('/:clientid/chats', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return;
    initHeaders(res)
    if(clientsOpened[req.params?.clientid]?.client && clientsOpened[req.params?.clientid]?.info.status == "ready"){
        const chats = (await clientsOpened[req.params?.clientid].client.getChats()).filter(chat=>!(req?.body?.filter??[]).includes(chat.id._serialized))
        try{res.send(chats.map(chat=>({userId: chat.id.user, name: chat.name, serialized: chat.id._serialized})))}catch(e){}
    }else{
        try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
    }
})
app.get('/:clientid/pic/:contactid', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return;
    initHeaders(res)
    if(clientsOpened[req.params?.clientid]?.client && clientsOpened[req.params?.clientid]?.info.status == "ready"){
        try{
            res.send({ url: (await clientsOpened[req.params?.clientid]?.client.getProfilePicUrl(req.params?.contactid)) })
        }catch(e){
            res.send({ url: "" })
        }
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
        const msgs = await chat.fetchMessages({limit: 1000000})
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

app.post('/:clientid/init', async (req, res) => {
    if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
    initHeaders(res)
    if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr  && clientsOpened[req.params?.clientid]?.client){
        const msgs = await Promise.all((await clientsOpened[req.params?.clientid].client.getChats()).filter(chat=>!(req?.body?.filter??[]).includes(chat.id._serialized)).map(async chat=>{
            const msgs = await chat.fetchMessages({limit: 1000000})
            return msgs.map(msg=>({ chatName: chat.name, content: msg.body, timestamp: msg.timestamp, fromMe: msg.fromMe }))
        })).then(arr=>arr.flat())
        const {error} = await supabase.from("AI_Examples").upsert({clientid: req.params?.clientid, example_for_ai: msgs})
        console.log(error)
        try{res.send(clientsOpened[req.params?.clientid].info)}catch(e){}
    }else{
        res.send(`Клиент ${req.params?.clientid} не аутефицирован`)
    }
})

// Wait for on('ready'... event
 
app.get('/:clientid/waitForStatusChange', async (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    clientsOpened[req.params?.clientid]?.client.emit('connect', "waitForStatusChange")
    clientsOpened[req.params?.clientid].waitForDestroy = -1;
    req.once('aborted', ()=> {
        console.log("aborted")
        clientsOpened[req.params?.clientid].waitForDestroy = 5;
        clientsOpened[req.params?.clientid]?.client.emit('aborted', "waitForStatusChange");
    })
    initHeaders(res)
    if(clientsOpened[req.params?.clientid]?.client){
        const eventFunc = (client) => {
            console.log(123)
            try{res.send(client.statusInfo)}catch(e){}
        }
        clientsOpened[req.params?.clientid]?.client.once('status_update', eventFunc)
        req.once('aborted', ()=> {
            clientsOpened[req.params?.clientid]?.client.removeListener('status_update', eventFunc)
        })
    }
})
app.get('/:clientid/status', async (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    initHeaders(res)
    if(clientsOpened[req.params?.clientid]?.client){
        try{res.send(clientsOpened[req.params?.clientid]?.client.statusInfo)}catch(e){}
    }
})

app.get('/:clientid/searchForSuitableChats', async (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    initHeaders(res)

    if(clientsOpened[req.params?.clientid]?.client){
        const gptclient = new GPTClient()
        console.log(await gptclient.searchForSuitableChats(clientsOpened[req.params?.clientid]?.client))
//         const gptclient = new GPTClient()
//         const chats = await gptclient.searchForSuitableChats(clientsOpened[req.params?.clientid]?.client)
// /*        console.log(chats)*/
//         try{res.send(chats)}catch(e){}
    }
})
app.delete('/:clientid', async (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    initHeaders(res)
    if(clientsOpened[req.params?.clientid]?.client){
        await clientsOpened[req.params?.clientid]?.client.logout()
        await clientsOpened[req.params?.clientid]?.client.removeClientFolder()
        console.log("delete client: " + req.params?.clientid)
    }else{
        try{res.send("client not found")}catch(e){}
    }
})
// post
app.post('/:clientid/generateAdditionally', async (req, res) => {
    if(req.params?.clientid === "favicon.ico")return
    initHeaders(res)

    if(clientsOpened[req.params?.clientid]?.client){
        const gptclient = new GPTClient()
        const additionally = await gptclient.generateAdditionally(150, 10, clientsOpened[req.params?.clientid]?.client, req?.body.arg, supabase)
        try{res.send(`${additionally}`)}catch(e){}
    }
})

// Launch on port 3000 

app.listen(3000)