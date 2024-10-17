module.exports = {
	type: "get",
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
            try{res.send(_client.statusInfo)}catch(e){console.log(e)}
        }
	}
}