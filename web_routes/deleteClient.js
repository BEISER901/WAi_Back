module.exports = {
	type: "delete",
	path: '/:clientid',
	async execute(
		{
			params: {
				clientid
			}
		}, res
	) {
		if(clientid === "favicon.ico")return
		const _client = this.getWAClient(clientid) 
        if(_client){
            await _client.logout()
            await _client.removeClientFolder()
            console.log("delete client: " + clientid)
            try{res.send("success")}catch(e){}
        }else{
            try{res.send("client not found")}catch(e){}
        }
	}
}