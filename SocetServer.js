const WebSocket = require("ws")
const EventEmitter = require('events')
const { randomUUID } = require('crypto')
const fs = require('fs')
const Client = require("./packages/WhatsApp_Client/Client.js")

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
    setInfoToFileCache(json){
        const fs = require('fs')
        try{
            fs.writeFileSync('./.clients_cache/clients_info.json', JSON.stringify(json))
        }catch(e){
            fs.mkdirSync("./.clients_cache")
            fs.writeFileSync('./.clients_cache/clients_info.json', JSON.stringify(json))
        }
    }
    createCommand(name, execute){
        this._commands.push({ name, execute })
    }
    initializeNewClients(){
        this.waitWAClients = this.getInfoFromFileCache().filter(({status})=>status=="wait").map(({id})=>{
            const _client = new Client()
            _client.id = id
            _client.initialize()
            return _client
        })
        for( let i = 0; i < this.options.absoluteCountAvailableClients - this.waitWAClients.length; i++ ){
            const _client = new Client()
            _client.once("launch", ()=>{
                this.setInfoToFileCache([...this.getInfoFromFileCache(), {id: _client.id, status: "wait"}])     
                this.waitWAClients.push(_client)
            })      
            _client.initialize()
        }
    }
    runAllWAClients(){
        console.log(this.waitWAClients)
        this.WAClients = this.WAClients.map(({id})=>{
            const _client = new Client()
            _client.id = id
            _client.initialize()
            return _client
        })
        this.initializeNewClients()
    }
    startServer(){
        const wsServer = new WebSocket.Server({server: this.server})
        this._wss = wsServer
        console.log("start server on port: ", this.port)

        this.setInfoToFileCache(this.getInfoFromFileCache().map(({id, status})=>status=="unconfirmed"?{id, status: "wait"}:{id, status}))
        this.WAClients = this.getInfoFromFileCache().filter(({status})=>status=="reserved")

        this.runAllWAClients()

        this.absoluteCountAvailableClients
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
