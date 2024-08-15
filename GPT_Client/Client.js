'use strict'

const systemInstructionLearn = require("fs").readFileSync(__dirname + "/.config/system_instruction_learning", "utf8") 

const { DefaultOptions } = require('./src/util/Constants')
const OpenAI = require("openai")

const openai = new OpenAI({ apiKey: process.env.GPT_API_KEY })

class Client {
	constructor(options = {}) {
        this.options = DefaultOptions;
    	this.chatCompletation = openai.chat.completions;
    }
    async Learn(examples, count_examples, count_messages) {
    	const instruction = systemInstructionLearn
    		.replace("__examples-count__", count_examples)
    		.replace("__examples-count__", count_messages)
    		.replace("__examples-count__", examples)
    	const completion = await openai.chat.completions.create({
		    messages: [
		      { 
		        role: "system", 
		        content: instruction
		      }, {
		        role: "user",
		        content: "Составь примеры переписок"
		      }],
		    ...this.options.GPT_learning
		  })
    	return completion.choices[0].message.content
    }
}
module.exports = Client