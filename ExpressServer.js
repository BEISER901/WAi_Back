import express from 'express';
import { Controller, Get, Post, Delete } from '@tuzilow/express-decorator';
import WAUtil from './WhatsApp_Client/src/util/Util';
import Client from "./WhatsApp_Client/src/Client.js"
import GPTClient from "./GPT_Client/Client.js"
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'

// Clients info

const clientsOpened = {}

const clientOpened = (client) => ({
    info: {
        id: client.id,
    },
    client: client
})

const startClient = async (clientId, onLaunch) => {
    const client = new Client()

    client.id = clientId


    client.on('qr', (qr) => {
        console.log(qr)
        qrcode.generate(qr, {small: true})
    })

    client.on('launch', async () => {
        clientsOpened[client.id] = client    
        if(onLaunch)onLaunch(client.id)
    })
    client.on('ready', async () => {
        if(client.statusInfo.recentMsgsSynced){
            await gptclient.startTraning(client, supabase)
        }
    })

    client.on("recent_msg_synced", async ()=>{
        await gptclient.startTraning(client, supabase)
    })

    await client.initialize();

    if(clientId){
        console.log("Running user with identifier: " + clientId)
    }else{
        console.log("A new client with the identifier: " + client.id)
    }

    client.on('message', async (reqmsg) => {
        const clientInfo = (await supabase.from("Clients").select().eq("clientid", client.id)).data[0]
        clientsOpened[client.id]={
            ...client,
            lastMessage: {
                ...(client.lastMessage??{}),
                [reqmsg.from]: reqmsg.body
            }
        }

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

        if(clientInfo.active)if(process.env.debug == "true"?reqmsg.from == "77071911700@c.us":!(data?.[0]?.dont_follow_chats??[]).includes(reqmsg.from)){
            const chat = await client.getChatById(reqmsg.from)
            await chat.sendStateTyping()
            const chat_msgs = await chat.fetchMessages({limit: 1000000})
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
                if(client?.lastMessage?.[reqmsg.from] != reqmsg.body){
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

// Utils

async function delay(ms) {
   // return await for better async stack trace support in case of errors.
   return await new Promise(resolve => setTimeout(resolve, ms));
}

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Server

const Server = express();

@Controller
class ClientRoutes {
    @Get('/:clientid')
    async info(req, res) {
        if(req.params?.clientid === "favicon.ico")return
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
/*        await (new Promise(resolve=>{
            setTimeout(()=>{
                if(clientsOpened[req.params?.clientid])
                    resolve()
            }, 1000)
            
        }))*/
        if(clientsOpened[req.params?.clientid]){
            try{res.send(clientOpened(clientsOpened[req.params?.clientid]).info)}catch(e){}
        }else{   
            startClient(req.params?.clientid=="auto"?null:req.params?.clientid, id=>{
                console.log(id)
                try{res.send(clientOpened(clientsOpened[id]).info)}catch(e){console.log(e)}
            })
        }
    }
    @Post('/:clientid/chats')
    async chats(req, res){
        if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return;
        initHeaders(res)
        if(clientsOpened[req.params?.clientid]){
            const chats = (await clientsOpened[req.params?.clientid].client.getChats()).filter(chat=>!(req?.body?.filter??[]).includes(chat.id._serialized))
            try{res.send(chats.map(chat=>({userId: chat.id.user, name: chat.name, serialized: chat.id._serialized})))}catch(e){}
        }else{
            try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
        }
    }
    @Get('/:clientid/pic/:contactid')
    async picture(req, res){        
        if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return;
        initHeaders(res)
        if(clientsOpened[req.params?.clientid] && clientsOpened[req.params?.clientid]?.info.status == "ready"){
            try{
                res.send({ url: (await clientsOpened[req.params?.clientid].getProfilePicUrl(req.params?.contactid)) })
            }catch(e){
                res.send({ url: "" })
            }
        }else{
            try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
        }
    }
    @Get('/:clientid/state')
    async state(req, res){
        if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return;
        initHeaders(res)

        if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr && clientsOpened[req.params?.clientid]){
            const state = await clientsOpened[req.params?.clientid].client.getState()
            try{res.send(state)}catch(e){}
        }else{
            try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
        }
    }
    @Get('/:clientid/status')
    async status(req, res){        
        if(req.params?.clientid === "favicon.ico")return
        initHeaders(res)
        if(clientsOpened[req.params?.clientid]){
            try{res.send(clientsOpened[req.params?.clientid].statusInfo)}catch(e){console.log(e)}
        }
    }
    @Get('/:clientid/chats/:chatid/messages')
    async messages(req, res){        
        if(req.params?.clientid === "favicon.ico" || req.params?.chatid === "favicon.ico")return
        initHeaders(res)
        if(clientsOpened[req.params?.clientid] && !clientsOpened[req.params?.clientid]?.qr  && clientsOpened[req.params?.clientid]){
            const chat = await clientsOpened[req.params?.clientid].client.getChatById(req.params?.chatid)
            const msgs = await chat.fetchMessages({limit: 1000000})
            try{res.send(msgs)}catch(e){}
        }else{
            try{res.send(`Клиент ${req.params?.clientid} не аутефицирован`)}catch(e){}
        }
    }
    @Get('/:clientid/waitForStatusChange')
    async waitForStatusChange(req, res){        
        if(req.params?.clientid === "favicon.ico")return
        clientsOpened[req.params?.clientid].emit('connect', "waitForStatusChange")
        clientsOpened[req.params?.clientid].waitForDestroy = -1;
        req.once('aborted', ()=> {
            console.log("aborted")
            clientsOpened[req.params?.clientid].waitForDestroy = 5;
            clientsOpened[req.params?.clientid].emit('aborted', "waitForStatusChange");
        })
        initHeaders(res)
        if(clientsOpened[req.params?.clientid]){
            const eventFunc = (client) => {
                console.log(123)
                try{res.send(client.statusInfo)}catch(e){}
            }
            clientsOpened[req.params?.clientid].once('status_update', eventFunc)
            req.once('aborted', ()=> {
                clientsOpened[req.params?.clientid].removeListener('status_update', eventFunc)
            })
        }
    }
    @Delete('/:clientid')
    async delete(req, res){        
        if(req.params?.clientid === "favicon.ico")return
        initHeaders(res)
        if(clientsOpened[req.params?.clientid]){
            await clientsOpened[req.params?.clientid].logout()
            await clientsOpened[req.params?.clientid].removeClientFolder()
            console.log("delete client: " + req.params?.clientid)
            try{res.send("success")}catch(e){}
        }else{
            try{res.send("client not found")}catch(e){}
        }
    }
    @Post('/:clientid/generateAdditionally')
    async generateAdditionally(req, res){        
        if(req.params?.clientid === "favicon.ico")return
        initHeaders(res)

        if(clientsOpened[req.params?.clientid]){
            
            const additionally = await gptclient.generateAdditionally(150, 10, clientsOpened[req.params?.clientid], req?.body.arg, supabase)
            try{res.send(`${additionally}`)}catch(e){}
        }
    }
}

Server.use(new ClientRoutes());

Server.use(cors());
Server.use(express.json())
Server.use(express.urlencoded({ extended: true }))

Server.listen(Number(process.env.EXPRESS_PORT??3000), () => {
  console.info('Server running');
});