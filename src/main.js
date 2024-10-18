const DirectusProvider = require("./sync_providers/DirectusProvider")
const FreeIPAProvider = require("./sync_providers/FreeIPAProvider");
const WikiJSProvider = require("./sync_providers/WikiJSProvider");
const utils = require("./utils")
const express = require('express');

let currentlySyncing = false
let queuedRequest = false
const app = express();

app.post('/sync', (req, res) => {
    console.log("Sync triggered!")
    sync();
    res.status(200).json({status:"ok"})
})


async function sync() {
    let diffCount = 0
    if(currentlySyncing){
        queuedRequest = true
        return
    }
    currentlySyncing = true
    try {
        

        
        var wikijs = new WikiJSProvider()
        
        var directus = new DirectusProvider()
        var freeipa = new FreeIPAProvider()
        await directus.updateCurrentState()
        
        await freeipa.updateCurrentState()
        
        await wikijs.updateCurrentState()
        
        let directus_diff = directus.calculateDiff()
        
        let masterState = freeipa.getCurrentState()
        // apply changes to masterState
        utils.applyChanges(masterState, directus_diff.diff)
        
        let apply_directusDiff = directus.calculateDiffForNewData(masterState)
        await directus.applyDiff(apply_directusDiff.diff)
        
        
        let apply_freeipaDiff =  freeipa.calculateDiffForNewData(masterState)
        await freeipa.applyDiff(apply_freeipaDiff.diff)
        
        let apply_wikijs_diff = wikijs.calculateDiffForNewData(masterState)
        await wikijs.applyDiff(apply_wikijs_diff.diff)
        
        directus.safeCurrentState()
        freeipa.safeCurrentState()
        currentlySyncing = false

        diffCount = apply_freeipaDiff.diffCount + apply_directusDiff.diffCount
    } catch (error) {
        console.log("An error occured while syncing! Trying again!")
        console.error(error)
        queuedRequest = true
    }
    if(diffCount > 0 || queuedRequest){
        queuedRequest = false
        console.log("Finished syncing, but started new iteration because changes were made!")
        freeipa.logout()
        sync()
        return 
    }
    console.log("Finished syncing")
    freeipa.logout()

}
//sync().then(() => {process.exit(1)})
app.listen(3000, () => {
    setInterval(sync, 1000 * 60 * 10)
    console.log('server listening on port 3000')

})
