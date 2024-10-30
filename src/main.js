const DirectusProvider = require("./sync_providers/DirectusProvider");
const DirectusUserProvider = require("./sync_providers/DirectusUserProvider");
const FreeIPAProvider = require("./sync_providers/FreeIPAProvider");
const GoogleCloudProvider = require("./sync_providers/GoogleCloudProvider");
const WikiJSProvider = require("./sync_providers/WikiJSProvider");
const utils = require("./utils")
const express = require('express');

let currentlySyncing = false
let queuedRequest = false
const app = express();

let DEBUG = true

app.post('/sync', (req, res) => {
    console.log("Sync triggered!")
    sync();
    res.status(200).json({status:"ok"})
})


async function sync() {
    let diffCount = 0
    let freeipa;
    if(currentlySyncing){
        queuedRequest = true
        return
    }
    currentlySyncing = true
    try {
        

        
        var wikijs = await WikiJSProvider.createInstance()
        
        var directus = await DirectusProvider.createInstance()
        freeipa = await FreeIPAProvider.createInstance()
        var directus_user = await DirectusUserProvider.createInstance()
        var google = await GoogleCloudProvider.createInstance()
        await google.updateCurrentState()
        //await directus_user.updateCurrentState()
        //await directus.updateCurrentState()
        
        
        await freeipa.updateCurrentState()
        
        //await wikijs.updateCurrentState()
        
        //let directus_diff = directus.calculateDiff()
        
        let masterState = freeipa.getCurrentState()

        // apply changes to masterState
        //utils.applyChanges(masterState, directus_diff.diff)        
        
        //let apply_directusDiff = directus.calculateDiffForNewData(masterState)
        //await directus.applyDiff(apply_directusDiff.diff)
        
        let googleDiff = google.calculateDiffForNewData(masterState)
        await google.applyDiff(googleDiff.diff)

        //let apply_freeipaDiff =  freeipa.calculateDiffForNewData(masterState)
        //await freeipa.applyDiff(apply_freeipaDiff.diff)
        
        //let apply_wikijs_diff = wikijs.calculateDiffForNewData(masterState)
        //await wikijs.applyDiff(apply_wikijs_diff.diff)
        
        //let apply_directus_userDiff = directus_user.calculateDiffForNewData(masterState)
        //await directus_user.applyDiff(apply_directus_userDiff.diff)
        
        //directus.safeCurrentState()
        // freeipa.safeCurrentState()
        // wikijs.safeCurrentState()
        // directus_user.safeCurrentState()

        currentlySyncing = false

        //diffCount = apply_freeipaDiff.diffCount + apply_directusDiff.diffCount
    } catch (error) {
        console.log("An error occured while syncing! Trying again!")
        console.error(error)
        queuedRequest = true
    }
    if(diffCount > 0 || queuedRequest){
        queuedRequest = false
        console.log("Finished syncing, but started new iteration because changes were made!")
        freeipa.logout()
        currentlySyncing = false
        sync()
        return 
    }
    console.log("Finished syncing")
    freeipa.logout()

}
if(DEBUG){
    sync().then(() => {process.exit(1)})
} else{
    app.listen(3000, () => {
        setInterval(sync, 1000 * 60 * 10)
        console.log('server listening on port 3000')
    
    })
    
}
