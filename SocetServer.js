const WebSocket = require("ws")
const EventEmitter = require('events')
const { randomUUID, randomBytes } = require('crypto')
const fs = require('fs')
const Client = require("./packages/WhatsApp_Client/Client.js")
const { ObservableArray } = require('./Utils/ObservableArray.js')


class SocketClient {
    constructor(ws, serverInfo){
        this.ws = ws
        this.serverInfo = serverInfo
        this.connection_id = null
    }
    initialize(){
        while(true){
            const uuid = randomUUID()
            const sClients = this.serverInfo.connections
            if(!sClients.some(socketClient=>socketClient.connection_id == uuid)){
                this.connection_id = uuid
                break
            }
        }         
        this.ws.on("message", (message)=>{
            const value = function(){
                try{
                    return JSON.parse(`${message}`)
                }catch(e){
                    return `${message}`
                }
            }()
            if(value.command){
                let command = this.serverInfo._commands.find((command)=>command.name==value.command)
                command = {...command, ...this}
                if(command?.execute)command.execute(...(value.args??[]))
            }
        })
    }
    _removeClient(){
        const sClients = this.serverInfo.connections
        sClients.splice(sClients.findIndex((socketClient)=>socketClient.connection_id == this.connection_id), 1)
    }
}

module.exports = class SocketServer extends EventEmitter {
    constructor(server, opts){
        super();
        this.absoluteCountAvailableClients = 
        this.server = server;
        this._wss = null;
        this._commands = [];
        this.connections = [];
        this.WAClients = []
        this.waitWAClients = []
        this.options = opts
    }

    getInfoFromFileCache(){
        const fs = require('fs')
        try{
            var clients = JSON.parse(fs.readFileSync('./.clients_cache/clients_info.json', 'utf8'))
            return clients
        }catch(e){
            return []
        }
    }
    setInfoToFileCache(json) {
        const fs = require('fs')
        try{
            fs.writeFileSync('./.clients_cache/clients_info.json', JSON.stringify(json))
        }catch(e){
            fs.mkdirSync("./.clients_cache")
            fs.writeFileSync('./.clients_cache/clients_info.json', JSON.stringify(json))
        }
    }
    createCommand(name, execute) {
        this._commands.push({ name, execute })
    }
    initializeNewClients(){
        // console.log(this.getInfoFromFileCache().filter(({status})=>status=="wait").length)
        // console.log(this.getInfoFromFileCache().filter(({status})=>status=="wait"))
        
        for( let i = 0; i < this.options.absoluteCountAvailableClients /* Count free whatsaap clients */ - this.waitWAClients.length /* Сurrent сount free whatsaap clients */; i++ ){
            const _client = new Client()
            _client.once("launch", ()=>{
                let _token = null
                while(true){
                    _token = randomBytes(64).toString("base64").substring(0, 70)
                    if(!this.getInfoFromFileCache().some(({ token })=>token == _token)){
                        break
                    }
                }
                _client._token = _token
                this.waitWAClients.push(_client)   
                this.setInfoToFileCache(
                    Object.assign(
                        [],
                        this.getInfoFromFileCache(), 
                        { 
                            [this.getInfoFromFileCache().some(({id})=>id==_client.id)?this.getInfoFromFileCache().findIndex(({id})=>id==_client.id):this.getInfoFromFileCache().length??(this.getInfoFromFileCache().length-1)]: 
                                { id: _client.id, status: "wait", _token: _token, WID: "" } 
                        }
                    )
                )
            })     
            _client.once("ready", ()=>{
                this.setInfoToFileCache(Object.assign(
                        [],
                        this.getInfoFromFileCache(), 
                        { 
                            [this.getInfoFromFileCache().some(({id})=>id==_client.id)?this.getInfoFromFileCache().findIndex(({id})=>id==_client.id):this.getInfoFromFileCache().length??(this.getInfoFromFileCache().length-1)]: 
                                { id: _client.id, status: "reserved", _token: _token, WID: "" } 
                        }
                    )
                )        
            })
            _client.initialize()
        }
    }
    runAllWAClients() {
        // Run and update whatsaap (reserved) clients in local variable this.WAClients
        this.WAClients = this.WAClients.map(({id, _token})=>{
            const _client = new Client()
            _client._token = _token
            _client.id = id
            _client.initialize()
            return _client
        })

        // Run and update whatsaap (wait) clients in local variable this.waitWAClients
        this.waitWAClients = this.getInfoFromFileCache().filter(({status})=>status=="wait").map(({id, _token})=>{
            const _client = new Client()
            _client._token = _token
            _client.id = id
            _client.initialize()
            return _client
        })

        // If count whatsaap (wait) clients lack they saving to file and adding to local variable this.waitWAClients
        this.initializeNewClients()
    }

    startServer() {
        // Run WebSocket server
        const wsServer = new WebSocket.Server({server: this.server})
        this._wss = wsServer


        // Update status for unconfirmed whatsaap clients to whatsaap wait clients, after rerunning server 
        this.setInfoToFileCache(this.getInfoFromFileCache().map(({id, status, ...props})=>status=="unconfirmed"?{id, status: "wait", ...props}:{id, status, ...props}))
        
        // Init local variable this.WAClients ( Reserved clients ) from file
        this.WAClients = this.getInfoFromFileCache().filter(({status})=>status=="reserved")

        // Run wait clients and reserved whatsaap clients
        this.runAllWAClients()

        // Event of check USER CLIENT connected
        wsServer.on('connection', (ws) => {
            const _socetClient = new SocketClient(ws, this)
            this.connections.push(_socetClient)
            _socetClient.initialize()
            ws.on("close", ()=>{
                _socetClient._removeClient()
            })
        })
    }
} 
