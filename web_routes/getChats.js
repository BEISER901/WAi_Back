module.exports = {
	type: "get",
	path: '/:clientid/chats',
	async execute(
		{
			params: {
				clientid
			}
		}, res
	) {
		if(clientid === "favicon.ico")return;
        const _client = this.getWAClient(clientid)
        if(_client){
            const chats = (await _client.client.getChats()).filter(chat=>!(req?.body?.filter??[]).includes(chat.id._serialized))
            try{res.send(chats.map(chat=>({userId: chat.id.user, name: chat.name, serialized: chat.id._serialized})))}catch(e){}
        }else{
            try{res.send(`Клиент ${clientid} не аутефицирован`)}catch(e){}
        }
	}
}