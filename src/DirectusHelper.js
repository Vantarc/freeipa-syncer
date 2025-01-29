var d = require('@directus/sdk')
const credentials = require("./credentials")
const fs = require('node:fs');

class DirectusHelper {
    
    static client;

    static async getDirectusClient(){
        if(!DirectusHelper.client) {
            DirectusHelper.client = d.createDirectus('https://cms.gatrobe.de').with(d.authentication()).with(d.rest());
            await DirectusHelper.client.login(credentials.DIRECTUS_USERNAME, credentials.DIRECTUS_PASSWORD);
        }
        return DirectusHelper.client
    }

    static destroyClient(){
        DirectusHelper.client = undefined;
    }

    static async uploadCSV(fileName, csv){ 
        const file = new Blob([csv], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('title', fileName);
        formData.append('file', file, fileName);
 
        let fileID =  await this.client.request(d.uploadFiles(formData)).catch(e => console.log(e))
        await this.client.request(d.updateFile(fileID.id, { folder: 'b2f8bdb1-1384-4e29-b9cf-ac72df94b2c9' }));


    }
}


module.exports = DirectusHelper