var d = require('@directus/sdk')
const credentials = require("./credentials")

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
        
    }
}


module.exports = DirectusHelper