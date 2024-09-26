'use strict'

const patternAnswer = require("fs").readFileSync(__dirname + "/.config/pattern_answer", "utf8") 
const patternSystem = require("fs").readFileSync(__dirname + "/.config/pattern_system", "utf8") 

const patternSearchchatsSystem = require("fs").readFileSync(__dirname + "/.config/pattern_searchchats_system", "utf8") 
const patternSearchchatsUser = require("fs").readFileSync(__dirname + "/.config/pattern_searchchats_user", "utf8") 

const patternGenerateUser = require("fs").readFileSync(__dirname + "/.config/pattern_generate_user", "utf8") 
const patternGenerateSystem = require("fs").readFileSync(__dirname + "/.config/pattern_generate_system", "utf8") 

const { DefaultOptions } = require('./src/util/Constants')
const OpenAI = require("openai")

const { File, Blob } = require("@web-std/file")

var fs = require('fs')

const openai = new OpenAI({ apiKey: process.env.GPT_API_KEY })

function* chunks(arr, n) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

async function delay(ms) {
  // return await for better async stack trace support in case of errors.
  return await new Promise(resolve => setTimeout(resolve, ms));
}

function generateJsonlText(array) {
	return array.map(line=>{
		return JSON.stringify(line)
	}).join("\n")
}

class Client {
	constructor(options = {}) {
        this.options = DefaultOptions;
    	this.chatCompletation = openai.chat.completions;
    }

    async startTraning(WAClient, supabase){
    	const job_id  = (await supabase.from("Clients").select("openai_job_id").eq("id", WAClient.info.wid._serialized)).data?.[0]?.openai_job_id
    	if(job_id){
	    	console.log("job_id", job_id)
	    	console.log("fine_tuned_model", (await openai.fineTuning.jobs.retrieve(job_id)).fine_tuned_model)
    		return
    	}
    	console.log("startTraning")
      await Promise.all((await openai.files.list()).data.filter(file=>file.id === `traningfile_${WAClient.info.wid._serialized}.jsonl`).map(async file=>{
      		try{await openai.files.del(file.id)}catch(e){}
      }))

      console.log((await openai.files.list()).data.filter(file=>file.id === `traningfile_${WAClient.info.wid._serialized}.jsonl`))
      console.log((await openai.files.list()))

    	const chats = await WAClient.getChats()
    	const msgs = (await Promise.all(chats.map(async chat=>{
    		const msgsFromChat = await chat.fetchMessages({limit: 1000000})
    		
    		let changeCount = 0
    		let msgsCollections = {system: "", fromMe: [], fromUser: []}

    		return msgsFromChat.map((currentMsg, idx, arr)=>{
    			const lastMsg = arr[idx-1]
    			if(lastMsg?.fromMe != currentMsg?.fromMe){
    				if(msgsCollections.fromMe.length>0 && msgsCollections.fromUser.length>0){
    					changeCount+=1
    					const saveMsgsCollections = msgsCollections
    					const date = new Date(lastMsg.timestamp * 1000)
    					saveMsgsCollections.system = `Ты работаешь в сфере бизнеса и разговариваешь с клиентами и мастерами которые тебе пишут в мессенджере WhatsApp. Пользователь записан как "${chat.name}" это может быть как его имя или может быть его номером телефона. Дата и время вопроса: ${date}. У пользователя также имеется дополительая информация такая как его индитификатор в WhatsApp: ${chat.id._serialized}.`
    					msgsCollections={system: "", fromMe: [], fromUser: []}
    					return {system: saveMsgsCollections.system, fromMe: saveMsgsCollections.fromMe.length==0?"":saveMsgsCollections.fromMe.map(msg=>msg.body??"").join("//newmessage//"), fromUser: saveMsgsCollections.fromUser.length==0?"":saveMsgsCollections.fromUser.map(msg=>msg.body??"").join("//newmessage//")}
    				}
    			}

    			if(currentMsg.fromMe){
    				msgsCollections.fromMe.push(currentMsg)
    			}else{
    				msgsCollections.fromUser.push(currentMsg)
    			}
    		}).filter(msg=>msg)
    	}))).flat()

    	const chatsIds = chats.map(chat=>chat.id._serialized)

    	const saveToFileText = generateJsonlText(msgs.map(msg=>({"messages": [{"role": "system", "content": msg.system}, {"role": "user", "content": msg.fromUser}, { role: "assistant", "content": msg.fromMe}]})))

    	const file = new File([ saveToFileText ] ,`traningfile_${WAClient.info.wid._serialized}.jsonl` , {
			  type: "text/plain",
			})

    	console.log("file compiled")

    	const f = await openai.files.create({ file: file, purpose: 'fine-tune' });
    	await openai.files.waitForProcessing(f.id)
      console.log("comlited: ", f);

      const fineTune = await openai.fineTuning.jobs.create({ training_file: f.id, model: 'gpt-4o-mini-2024-07-18' })
      console.log(fineTune)
      const { error } = await supabase.from("Clients").update({openai_job_id: fineTune.id}).eq("id", WAClient.info.wid._serialized)
      console.log(error)

      const openai_model = await (new Promise(async (resolve)=>{      	
	      while(true){	      	
	      	const openai_model = (await openai.fineTuning.jobs.retrieve(fineTune.id)).fine_tuned_model
	      	if(openai_model){
	      		resolve(openai_model)
	      		break
	      	}
	      	await delay(1000)
	      }
      })) // wait for finish

      await supabase.from("Clients").update({ completed_stages: {trained: true}, openai_model: openai_model }).eq("id", WAClient.info.wid._serialized)
      console.log("finished")
    }

    async Answer(yourename, username, message, time, examples, additionally, all_messages, supabase, WAClient) {
    	const openai_model  = (await supabase.from("Clients").select("openai_model").eq("id", WAClient.info.wid._serialized)).data?.[0]?.openai_model
    	const [patternanswer, patternsystem] = [patternAnswer, patternSystem].map(text=>
    		text
    		.replace("__your_name__", yourename)
    		.replace("__user_name__", username)
    		.replace("__message__", message)
    		.replace("__time__", time.toString())
    		.replace("__examples__", (examples??[]).filter((msg, index, arr)=>(msg.content??"").length > 0 ).map((msg, index, arr)=>(parseInt((new Date(msg.timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))!=parseInt((new Date((arr[index-1]??{timestamp:0}).timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))?"\n --- Начало общения с аудиторией ---\n":"") + (msg.fromMe?`//newmessage// ${msg.content}`:`${(arr[index-1]??msg).fromMe != msg?"\nОтвет аудитории: ": ""}//newmessage// ${msg.content}${(arr[index-1]??msg).fromMe != msg.fromMe ?"\n": ""}`)).join(" "))
    		.replace("__additionally__", additionally)
    		.substring(0, 300000)
    	)
    	console.log(patternsystem)
    	console.log(all_messages
		      .filter((msg, index, arr)=>(msg.content??"").length > 0 )
		      .map((msg, index, arr)=>msg.fromMe?
		      	{
			        role: "assistant",
			        content: msg.content
		      	}
		      :
		      	{
			        role: "user",
			        content: msg.content
		      	}
		      ))
    	const completion = await openai.chat.completions.create({
		    messages: [
		      { 
		        role: "system", 
		        content: patternsystem
		      },
		      ...all_messages
		      .filter((msg, index, arr)=>(msg.content??"").length > 0 )
		      .map((msg, index, arr)=>msg.fromMe?
		      	{
			        role: "assistant",
			        content: msg.content
		      	}
		      :
		      	{
			        role: "user",
			        content: msg.content
		      	}
		      ) 
		    ],
		    model: openai_model
		  })
    	return completion.choices[0].message.content
    }
    async searchForSuitableChats(client){

    }

    async generateAdditionally(additionallyLength, chunksLength, WAClient, argText, supabase){
    	let chats = await WAClient.getChats()
    	if(!chats.length)return
    	const chatMsgs = await Promise.all(chats.map(async chat=>{
	        const msgs = await chat.fetchMessages({limit: 1000000})
	        return {chatid: chat.id._serialized, msgs: msgs.map(msg=>({ content: msg.body, timestamp: msg.timestamp, fromMe: msg.fromMe }))}
	   	}))
	    	const [patterngeneratesystem, patterngenerateuser] = [patternGenerateSystem, patternGenerateUser].map(text=>
	    		text
	    		.replace("__pattern__", 
`
Ты занимаешься бизнесом под наименованием "//INPUT{value: "НАИМЕНОВАНИЕ КОМПАНИИ"}INPUT//"
Твой бизнес занимается ...
	...

`
					)
					.replace("__arg__", argText)
	    		.replace("__your_name__", WAClient.info.pushname)
	    		.replace("__additionally-length_", additionallyLength)
					.replace("__chatsmsgs__",chatMsgs.map(({chatid, msgs})=>{
	    			return(
						`Переписка с пользователем "${chatid}":\n ${
							msgs.map(msg=>{
								return(
									msgs.fromMe?
										`	Сообщение от аудитории: "${msg.content}"`
									:
										`	Сообщение от пользователя "${chatid}": "${msg.content}"`
								)
							}).join("\n")
						}`
	    			)
	    		}).join("\n").substring(0, 20000))
				)
    	let completion = await openai.chat.completions.create({
			    messages: [
			      { 
			        role: "system", 
			        content: patterngeneratesystem
			      }, {
			        role: "user",
			        content: patterngenerateuser
			      }
			    ],
			    ...this.options.GPT_learning
			})
			return completion.choices[0].message.content
   }
}
module.exports = Client