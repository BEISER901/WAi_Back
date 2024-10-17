const Client = require.main.require("./packages/WhatsApp_Client/Client.js")

module.exports = {
	name: 'client_connect',
	execute(...ids) {
		if(!ids?.length){
			// Auto creating
			const _client = this.serverInfo.waitWAClients[0]
			this.ws.on("close", ()=>{
				this.serverInfo.setInfoToFileCache(
					this.serverInfo.getInfoFromFileCache().map(({id, status})=>{
						if(id == _client.id){
							return ({
								id,
								status: "wait"
							})
						}else{
							return ({
								id,
								status
							})
						}
					})
				)
			})	
			this.serverInfo.setInfoToFileCache(
				this.serverInfo.getInfoFromFileCache().map(({id, status})=>{
					if(id == _client.id){
						return ({
							id,
							status: "unconfirmed"
						})
					}else{
						return ({
							id,
							status
						})
					}
				})
			)
			this.serverInfo.initializeNewClients()
			const eventFunc = (client) => {
                this.ws.send(JSON.stringify({ client_id: _client.id, status: _client.statusInfo }))
			}
			_client.on('status_update', eventFunc)
			_client.on('ready', ()=>{
				this.serverInfo.setInfoToFileCache(
					this.serverInfo.getInfoFromFileCache().map(({id, status})=>{
						if(id == _client.id){
							return ({
								id,
								status: "reserved"
							})
						}else{
							return ({
								id,
								status
							})
						}
					})
				)
				delete this.serverInfo.waitWAClients[this.serverInfo.waitWAClients.findIndex(({ id })=>_client.id == id)]
				this.serverInfo.WAClients.push(_client)
			})
			this.ws.send(JSON.stringify({ client_id: _client.id, status: _client.statusInfo }))
			this.serverInfo.WAClients.push(_client)
			this.serverInfo.waitWAClients.splice(this.serverInfo.waitWAClients.findIndex(WAClient=>WAClient.id = _client.id), 1)
		}else{
			// By ids
			ids.map(clientId=>{
				const client = this.serverInfo.WAClients.find(({id})=>id==clientId)
				let _client = null
				if(client){
					_client = client
				}else{
					_client = new Client()
					_client.id = clientId
					_client.once("launch", ()=>{
						this.serverInfo.WAClients[this.serverInfo.WAClients.findIndex(({id})=>id==clientId)] = _client
					})
					const eventFunc = (client) => {
		                this.ws.send(JSON.stringify({ client_id: client.id, status: client.statusInfo }))
					}
					_client.on('status_update', eventFunc)
					_client.initialize()
				}
			})
		}
	}
}