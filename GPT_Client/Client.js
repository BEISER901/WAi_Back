'use strict'

const patternAnswer = require("fs").readFileSync(__dirname + "/.config/pattern_answer", "utf8") 
const patternSystem = require("fs").readFileSync(__dirname + "/.config/pattern_system", "utf8") 

const { DefaultOptions } = require('./src/util/Constants')
const OpenAI = require("openai")

const openai = new OpenAI({ apiKey: process.env.GPT_API_KEY })

class Client {
	constructor(options = {}) {
        this.options = DefaultOptions;
    	this.chatCompletation = openai.chat.completions;
    }
    async Answer(yourename, username, message, time, examples, additionally) {
    	const [patternanswer, patternsystem] = [patternAnswer, patternSystem].map(text=>
    		text
    		.replace("__your_name__", yourename)
    		.replace("__user_name__", username)
    		.replace("__message__", message)
    		.replace("__time__", time)
    		.replace("__examples__", examples.filter((msg, index, arr)=>(msg.content??"").length > 0 ).map((msg, index, arr)=>(parseInt((new Date(msg.timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))!=parseInt((new Date((arr[index-1]??{timestamp:0}).timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))?"\n --- Начало общения с аудиторией ---\n":"") + (msg.fromMe?`//newmessage// ${msg.content}`:`${(arr[index-1]??msg).fromMe != msg?"\nОтвет аудитории: ": ""}//newmessage// ${msg.content}${(arr[index-1]??msg).fromMe != msg.fromMe ?"\n": ""}`)).join(" "))
    		.replace("__additionally__", additionally)
    		.substring(0, 300000)
    	)
    	console.log(examples.filter((msg, index, arr)=>(msg.content??"").length > 0 ).map((msg, index, arr)=>(parseInt((new Date(msg.timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))!=parseInt((new Date((arr[index-1]??{timestamp:0}).timestamp*1000)).getTime() / (1000 * 60 * 60 * 24))?"\n --- Начало общения с аудиторией ---\n":"") + (msg.fromMe?`//newmessage// ${msg.content}`:`${(arr[index-1]??msg).fromMe != msg?"\nОтвет аудитории: ": ""}//newmessage// ${msg.content}${(arr[index-1]??msg).fromMe != msg.fromMe ?"\n": ""}`)).join(" "))
    	const completion = await openai.chat.completions.create({
		    messages: [
		      { 
		        role: "system", 
		        content: patternsystem
		      }, {
		        role: "user",
		        content: patternanswer
		      }],
		    ...this.options.GPT_learning
		  })
    	return completion.choices[0].message.content
    }
}
module.exports = Client