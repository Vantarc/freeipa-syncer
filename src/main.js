const DirectusProvider = require("./sync_providers/DirectusProvider")
const FreeIPAProvider = require("./sync_providers/FreeIPAProvider")
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
    if(currentlySyncing){
        queuedRequest = true
        return
    }
    currentlySyncing = true
    var directus = new DirectusProvider()
    var freeipa = new FreeIPAProvider()
    await directus.updateCurrentState().catch(e => console.log(e))

    await freeipa.updateCurrentState().catch(e => console.log(e))
    let directus_diff = directus.calculateDiff()
    
    let masterState = freeipa.getCurrentState()
    // apply changes to masterState
    utils.applyChanges(masterState, directus_diff.diff)

    let apply_freeipaDiff =  freeipa.calculateDiffForNewData(masterState)
    await freeipa.applyDiff(apply_freeipaDiff.diff).catch(e => console.log(e))

    let apply_directusDiff = directus.calculateDiffForNewData(masterState)
    await directus.applyDiff(apply_directusDiff.diff).catch(e => console.log(e))

    directus.safeCurrentState()
    freeipa.safeCurrentState()
    currentlySyncing = false
    if(apply_freeipaDiff.diffCount + apply_directusDiff.diffCount > 0 || queuedRequest){
        queuedRequest = false
        console.log("Finished syncing, but started new iteration because changes were made!")
        sync()
        return 
    }
    console.log("Finished syncing")
}

app.listen(3000, () => {
    setInterval(sync, 1000 * 60 * 10)
    console.log('server listening on port 3000')

})
