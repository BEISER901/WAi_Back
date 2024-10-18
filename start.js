#!/usr/bin/env -S node  --no-warnings --env-file=.env
const SocetServer = require("./SocetServer")
const fs = require('fs')
const express = require('express');
const cors = require('cors');

// Web Server

const server = express();

server.use(cors());
server.use(express.json())
server.use(express.urlencoded({ extended: true }))

const routeFiles = fs
  .readdirSync('./web_routes')
  .filter((file) => file.endsWith('.js'))
for (const file of routeFiles) {
  const route = require(`./web_routes/${file}`)
  server[route.type](route.path, route.execute.bind(
        { 
            ...route, 
            getWAClients: ()=>socetServer.WAClients, 
            getWAClient: (id)=>socetServer.WAClients[id]
        }
    ))
}

// Socket Server

function getAllClientsFoldersId(){
    return (()=>{try{return fs.readdirSync("./.clients_cache/")}catch(e){}})()??[]
}

const socetServer = new SocetServer( server, 
        { 
            absoluteCountAvailableClients: 5
        }
    )


const commandFiles = fs
  .readdirSync('./socket_commands')
  .filter((file) => file.endsWith('.js'))
for (const file of commandFiles) {
  const command = require(`./socket_commands/${file}`)
  socetServer.createCommand(command.name, command.execute)
}

socetServer.startServer()

server.listen(3000)