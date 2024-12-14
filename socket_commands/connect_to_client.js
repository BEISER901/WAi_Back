const Client = require.main.require("./packages/WhatsApp_Client/Client.js")

module.exports = {
	name: 'client_connect',
	execute(...ids) {
		if(!ids?.length){
			// Auto creating
			const _client = this.serverInfo.waitWAClients.findLast(({ statusInfo: { clientProgressStatus } })=>clientProgressStatus == "qr")
			if(!_client)return
			this.ws.on("close", ()=>{
				
				this.serverInfo.setInfoToFileCache(
					this.serverInfo.getInfoFromFileCache().map(({id, status, ...props})=>{
						if(id == _client.id){
							return ({
								id,
								status: "wait",
								...props
							})
						}else{
							return ({
								id,
								status,
								...props
							})
						}
					})
				)
				this.serverInfo.waitWAClients.push(_client)
			})	
			this.serverInfo.setInfoToFileCache(
				this.serverInfo.getInfoFromFileCache().map(({id, status, ...props})=>{
					if(id == _client.id){
						return ({
							id,
							status: "unconfirmed",
							...props
						})
					}else{
						return ({
							id,
							status,
							...props
						})
					}
				})
			)
			const eventFunc = (client) => {
				// console.log(_client._token)
				// console.log({ client_id: _client.id, status: _client.statusInfo, _token: _client._token })
                if(_client?.statusInfo?.clientProgressStatus == "ready"){
					const fileCache = this.serverInfo.getInfoFromFileCache()
					if(fileCache.some(({ WID })=>WID == _client.info.wid._serialized)){
                		this.ws.send(JSON.stringify({ client_id: _client.id, status: _client.statusInfo, _token:  fileCache.find(({ WID })=>WID == _client.info.wid._serialized)?._token}))
						(async ()=>{
							try{
								this.serverInfo.setInfoToFileCache(
									fileCache.filter(({id})=>id != _client.id)
								)
								console.log(555)
								await _client.logout()
								await _client.removeClientFolder()
							}catch(e){}
						})()
						return
					}else{
						this.serverInfo.setInfoToFileCache(
							fileCache.map(({id, status, WID, ...props})=>{
								if(id == _client.id){
									return ({
										id,
										status: "reserved",
										WID: _client.info.wid._serialized,
										...props,
									})
								}else{
									return ({
										id,
										status,
										...props
									})
								}
							})
						)
						this.serverInfo.WAClients.push(_client)
					}
                }
                this.ws.send(JSON.stringify({ client_id: _client.id, status: _client.statusInfo, _token: _client?.statusInfo?.clientProgressStatus == "ready"?_client._token:null }))
			}
			_client.on('status_update', eventFunc)
			eventFunc(_client)
			this.serverInfo.WAClients.push(_client)
			this.serverInfo.waitWAClients.splice(this.serverInfo.waitWAClients.findIndex(WAClient=>WAClient.id = _client.id), 1)
			this.serverInfo.initializeNewClients()
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
		                this.ws.send(JSON.stringify({ client_id: client.id, status: client.statusInfo, _token: _client._token }))
					}
					_client.on('status_update', eventFunc)
					_client.initialize()
				}
			})
		}
	}
}