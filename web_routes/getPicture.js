module.exports = {
	type: "get",
	path: '/:clientid/pic/:contactid',
	async execute(
		{
			params: {
				clientid,
				contactid
			}
		}, res
	) {
        if(clientid === "favicon.ico" || contactid === "favicon.ico")return;
        const _client = this.getWAClient(clientid)
        if(_client && _client?.info.status == "ready"){
            try{
                res.send({ url: (await _client.getProfilePicUrl(contactid)) })
            }catch(e){
                res.send({ url: "" })
            }
        }else{
            try{res.send(`Клиент ${clientid} не аутефицирован`)}catch(e){}
        }
	}
}