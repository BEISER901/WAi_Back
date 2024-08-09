#!/usr/bin/env -S node --no-warnings

// ./start.js

const Client = require("./src/Client.js")
const qrcode = require('qrcode-terminal')
const client = new Client()

client.id = null

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
	qrcode.generate(qr, {small: true})
});

function compare( a, b ) {
  if ( a.rowId < b.rowId ){
    return 1;
  }
  if ( a.rowId > b.rowId ){
    return -1;
  }
  return 0;
}

// https://web.whatsapp.com/send/?phone=77052115569

client.on('ready', async () => {
    const chats = await client.getChats()
    // chats[index] index is where chat you have get, index - 0 is first chat in your list.
    await client.openChat(chats[0].name)
    console.log(await client.getCurrentChatName())
    console.log(await client.getAllMessages())
});


client.initialize();



// var r = indexedDB.open("model-storage");
// r.onsuccess = function(event) {
//     var db = event.target.result;
//     let transaction = db.transaction("message", "readwrite")
//     let message = transaction.objectStore("message")
//     result = message.getAll())
// }

/*result.result.filter(msg=>msg.id.includes("_out") && msg.type == "chat")*/